import { AlibabaAPI } from './alibaba-api';
import { getListingPoolTimezone } from './alibaba-product-utils';
import { getAuthorizedApiClient } from './api-client';
import { CampaignManager } from './campaign-manager';
import {
  appendListingPairs,
  fetchProductsInDateRange,
  shuffle,
  type DuplicateBatchResult,
  type DuplicatePair,
} from './duplicate-pool';

export type { DuplicateBatchResult, DuplicatePair };
import {
  clearProductKeywords,
  ensurePhotobankFileIds,
  extractLadderMoq,
  extractSchemaFieldMap,
  extractSchemaImages,
  injectCustomDescription,
  injectMarketTradeFields,
  injectSchemaImages,
  injectXmlField,
  prepareSchemaXmlForPublish,
} from './schema-listing-xml';
import {
  resolveDefaultPhotobankGroupId,
  unwrapDescriptionHtml,
} from './listing-v2-normalizer';
import { rearrangeTitleMinimalUnique } from './title-rearranger';

const DEFAULT_CAT_ID = 100009031;

function categoryIdFromSource(sourceProductId: string, getRes: any): number {
  const info = AlibabaAPI.extractProductInfoV2(getRes);
  const fromInfo =
    info?.category_id ??
    info?.categoryId ??
    (info as { category_info?: { category_id?: number } })?.category_info?.category_id;
  if (fromInfo != null) return Number(fromInfo);

  const campaign = CampaignManager.getCampaigns().find(
    (c) => c.template?.baseProductId === sourceProductId || c.id === `imported_${sourceProductId}`
  );
  if (campaign?.template?.category) return Number(campaign.template.category);
  return DEFAULT_CAT_ID;
}

async function applyListingV2AiOptimization(
  api: AlibabaAPI,
  productId: string,
  seedTitle: string,
  images: { url: string; fileId: string }[],
  sourceInfo: Record<string, unknown>,
  catId: number
): Promise<{ message: string; title?: string; aiDraftId?: string }> {
  const product_image = images.map((img, i) => ({
    file_id: img.fileId,
    image_url: img.url,
    sort: i + 1,
  }));
  const res = await api.createListingV2({
    product_info: {
      product_id: productId,
      category_info: sourceInfo.category_info,
      trade_info: sourceInfo.trade_info,
      basic_info: {
        product_id: productId,
        subject: seedTitle,
        title: seedTitle,
        product_image,
      },
    },
    ai_optimization_config: {
      title_optimization_enabled: true,
      description_optimization_enabled: true,
      keyword_optimization_enabled: true,
    },
  });
  const message =
    res?.result?.message ||
    res?.result?.msg ||
    res?.message ||
    JSON.stringify(res).substring(0, 200);

  const aiDraftId =
    res?.result?.data != null && String(res.result.data) !== productId
      ? String(res.result.data)
      : undefined;

  let title: string | undefined;
  await new Promise((r) => setTimeout(r, 4000));

  const readTitleFromId = async (id: string): Promise<string | undefined> => {
    try {
      const info = AlibabaAPI.extractProductInfoV2(await api.getProductV2(id));
      if (info) return AlibabaAPI.getProductTitle(info);
    } catch {
      try {
        const xml = await api.renderDraftProductSchema(id, catId);
        const m = xml.match(
          /<field id="productTitle"[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/
        );
        if (m) {
          return m[1]
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
            .replace(/&amp;/g, '&')
            .trim();
        }
      } catch {
        /* skip */
      }
    }
    return undefined;
  };

  title = await readTitleFromId(aiDraftId ?? productId);
  return { message, title, aiDraftId };
}

export async function duplicateProductV2(
  api: AlibabaAPI,
  sourceProductId: string,
  usedTitles: Set<string>,
  options?: {
    photobankGroupId?: string;
    /** schema/add live publish (default true) */
    publish?: boolean;
    /** listing/v2 AI flags after publish (default true) */
    aiOptimize?: boolean;
  }
): Promise<DuplicatePair> {
  const publish = options?.publish !== false;
  const aiOptimize = options?.aiOptimize !== false;
  const getRes = await api.getProductV2(sourceProductId);
  const sourceInfo = AlibabaAPI.extractProductInfoV2(getRes);
  if (!sourceInfo) {
    throw new Error(`get/v2 returned no product_info for ${sourceProductId}`);
  }

  const sourceTitle = AlibabaAPI.getProductTitle(sourceInfo);
  const { title: seedTitle } = rearrangeTitleMinimalUnique(
    sourceTitle,
    sourceProductId,
    usedTitles
  );
  const catId = categoryIdFromSource(sourceProductId, getRes);
  const photobankGroupId =
    options?.photobankGroupId ?? (await resolveDefaultPhotobankGroupId(api));

  let xml = await api.renderProductSchema(sourceProductId, catId);
  const schemaFields = extractSchemaFieldMap(xml);
  const descriptionHtml = unwrapDescriptionHtml(
    (sourceInfo.basic_info as { description?: unknown } | undefined)?.description
  );

  const renderImages = extractSchemaImages(xml);
  if (!renderImages.length) {
    throw new Error('schema/render returned no product images');
  }
  const publishableImages = await ensurePhotobankFileIds(
    api,
    renderImages,
    photobankGroupId
  );
  xml = injectSchemaImages(xml, publishableImages);
  xml = injectXmlField(xml, 'productTitle', `<![CDATA[${seedTitle}]]>`);
  if (publish) {
    // Live schema/add requires keywords; listing/v2 AI replaces them after publish.
  } else {
    xml = clearProductKeywords(xml);
  }

  const moq =
    extractLadderMoq(xml) ||
    String(
      (sourceInfo as { trade_info?: { moq?: number } }).trade_info?.moq ??
        schemaFields.marketMinOrderQuantity ??
        '1'
    );
  // Schema API cannot copy smart-editor pageData (get/v2 JSON). Inject HTML as custom
  // description; live publish allows max 30 inline images (source may have 31).
  xml = injectCustomDescription(xml, descriptionHtml, publish ? { maxImages: 30 } : undefined);
  xml = prepareSchemaXmlForPublish(xml, catId);
  xml = injectMarketTradeFields(xml, {
    moq,
    samplingQuantity: schemaFields.marketSamplingQuantity || '1',
    samplingPrice: schemaFields.marketSamplingPrice,
  });

  const createRes = publish
    ? await api.addProductSchema(catId, xml)
    : await api.addProductSchemaDraft(catId, xml);
  if (createRes?.result?.success === false) {
    throw new Error(
      createRes.result?.msg ||
        createRes.result?.message ||
        createRes.result?.message_info ||
        `schema/add failed: ${JSON.stringify(createRes).substring(0, 200)}`
    );
  }

  const cloneId = AlibabaAPI.extractSchemaDraftProductId(createRes);
  if (!cloneId) {
    throw new Error(
      `schema/add did not return product_id: ${JSON.stringify(createRes).substring(0, 300)}`
    );
  }

  let cloneTitle: string | undefined;
  let aiOptimizationMessage: string | undefined;
  let aiTitle: string | undefined;
  let aiDraftId: string | undefined;

  if (publish) {
    try {
      const publishedXml = await api.renderProductSchema(cloneId, catId);
      const m = publishedXml.match(
        /<field id="productTitle"[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/
      );
      if (m) {
        cloneTitle = m[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
          .replace(/&amp;/g, '&')
          .trim();
      }
    } catch {
      /* optional */
    }
  } else {
    try {
      const draftXml = await api.renderDraftProductSchema(cloneId, catId);
      const m = draftXml.match(
        /<field id="productTitle"[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/
      );
      if (m) {
        cloneTitle = m[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
          .replace(/&amp;/g, '&')
          .trim();
      }
    } catch {
      /* optional */
    }
  }

  if (publish && aiOptimize) {
    try {
      const aiRes = await applyListingV2AiOptimization(
        api,
        cloneId,
        seedTitle,
        publishableImages,
        sourceInfo as Record<string, unknown>,
        catId
      );
      aiOptimizationMessage = aiRes.message;
      aiTitle = aiRes.title;
      aiDraftId = aiRes.aiDraftId;
    } catch (err) {
      aiOptimizationMessage =
        err instanceof Error ? err.message : String(err);
    }
  }

  return {
    source: sourceProductId,
    clone: cloneId,
    sourceTitle,
    seedTitle,
    cloneTitle,
    aiTitle,
    aiDraftId,
    createdAt: new Date().toISOString(),
    isDraft: !publish,
    method: publish ? 'schema/publish' : 'schema/draft',
    listingMessage: publish
      ? 'Published via schema/render → schema/add (live)'
      : 'Created via schema/render → schema/add/draft',
    aiOptimizationMessage,
  };
}

export async function runDuplicateBatchV2(options?: {
  startDate?: string;
  endDate?: string;
  count?: number;
  delayMs?: number;
  publish?: boolean;
  aiOptimize?: boolean;
}): Promise<DuplicateBatchResult> {
  const startDate = options?.startDate ?? '2026-05-26';
  const endDate = options?.endDate ?? '2026-06-01';
  const targetCount = options?.count ?? 5;
  const delayMs = options?.delayMs ?? 5000;

  const api = await getAuthorizedApiClient();
  if (!api) {
    return {
      success: false,
      attempted: 0,
      successful: 0,
      pairs: [],
      failures: [],
      error: 'Alibaba API credentials are not configured.',
    };
  }

  const publish = options?.publish !== false;
  const aiOptimize = options?.aiOptimize !== false;

  const pool = shuffle(await fetchProductsInDateRange(api, startDate, endDate));
  console.log(
    `Date range ${startDate} .. ${endDate} (${getListingPoolTimezone()} calendar): ${pool.length} product(s) in pool`
  );

  if (!pool.length) {
    return {
      success: false,
      attempted: 0,
      successful: 0,
      pairs: [],
      failures: [],
      error: `No products found modified between ${startDate} and ${endDate}.`,
    };
  }

  const photobankGroupId = await resolveDefaultPhotobankGroupId(api);
  console.log(`Photobank group: ${photobankGroupId}`);
  console.log(
    publish
      ? `Publish method: schema/render → schema/add (live)${aiOptimize ? ' + listing/v2 AI' : ''}`
      : 'Duplicate method: schema/render → schema/add/draft'
  );

  const pairs: DuplicatePair[] = [];
  const failures: Array<{ source: string; reason: string }> = [];
  const usedTitles = new Set<string>();
  let attempted = 0;

  for (const item of pool) {
    if (pairs.length >= targetCount) break;
    attempted++;
    console.log(`\n[${pairs.length + 1}/${targetCount}] ${item.title} (${item.id})`);

    try {
      const pair = await duplicateProductV2(api, item.id, usedTitles, {
        photobankGroupId,
        publish,
        aiOptimize,
      });
      pair.name = item.title;
      pairs.push(pair);
      console.log(`  ✓ ${publish ? 'published' : 'draft'} ${pair.source} → ${pair.clone}`);
      console.log(`    seed title: ${pair.seedTitle}`);
      if (pair.cloneTitle) console.log(`    schema title: ${pair.cloneTitle}`);
      if (pair.aiTitle) console.log(`    AI title: ${pair.aiTitle}`);
      if (pair.aiDraftId) console.log(`    AI draft id: ${pair.aiDraftId}`);
      if (pair.aiOptimizationMessage) {
        console.log(`    AI response: ${pair.aiOptimizationMessage}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ source: item.id, reason });
      console.log(`  ✗ ${reason}`);
    }

    if (pairs.length < targetCount && attempted < pool.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (pairs.length) appendListingPairs(pairs);

  return {
    success: pairs.length > 0,
    attempted,
    successful: pairs.length,
    pairs,
    failures,
    error: pairs.length === 0 ? failures[0]?.reason ?? 'No listings created' : undefined,
  };
}
