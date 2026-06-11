'use server';

import { getAuthorizedApiClient } from '@/lib/api-client';
import { AlibabaAPI } from '@/lib/alibaba-api';
import {
  buildListingSnapshotFromSchemaXml,
  buildListingSnapshotV2,
  compareListingSnapshotsV2,
  type ListingComparisonRow,
  type ListingSnapshot,
} from '@/lib/listing-v2-compare';
import { CampaignManager } from '@/lib/campaign-manager';

const DEFAULT_CAT_ID = 100009031;

function categoryIdForProduct(productId: string): number {
  const campaign = CampaignManager.getCampaigns().find(
    (c) => c.template?.baseProductId === productId || c.id === `imported_${productId}`
  );
  if (campaign?.template?.category) return Number(campaign.template.category);
  return DEFAULT_CAT_ID;
}

export type ProductSearchOption = {
  productId: string;
  campaignId: string;
  name: string;
  categoryId: string;
  imageUrl?: string;
  alibabaStatus?: string;
  gmtModified?: string;
};

export type ListingCompareSummary = {
  leftProductId: string;
  rightProductId: string;
  leftSubject: string;
  rightSubject: string;
  leftDescriptionChars: number;
  rightDescriptionChars: number;
  leftImageCount: number;
  rightImageCount: number;
};

export type ListingCompareResult = {
  left: ListingSnapshot;
  right: ListingSnapshot;
  rows: ListingComparisonRow[];
  summary: ListingCompareSummary;
  differenceCount: number;
};

function listRowToSearchOption(product: Record<string, unknown>): ProductSearchOption {
  const productId = String(product.id || product.product_id || '').trim();
  const images = (product as { main_image?: { images?: string[] } }).main_image?.images;
  return {
    productId,
    campaignId: productId ? `imported_${productId}` : '',
    name: String(
      product.subject || product.product_name || product.title || productId || 'Untitled'
    ),
    categoryId: String(product.category_id || product.categoryId || '100009031'),
    imageUrl: images?.[0],
    alibabaStatus: product.status ? String(product.status) : undefined,
    gmtModified: product.gmt_modified
      ? String(product.gmt_modified)
      : product.gmtModified
        ? String(product.gmtModified)
        : undefined,
  };
}

function dedupeSearchOptions(options: ProductSearchOption[]): ProductSearchOption[] {
  const seen = new Set<string>();
  const out: ProductSearchOption[] = [];
  for (const opt of options) {
    if (!opt.productId || seen.has(opt.productId)) continue;
    seen.add(opt.productId);
    out.push(opt);
  }
  return out;
}

export async function searchProductsForCompareAction(
  query: string
): Promise<
  | { success: true; products: ProductSearchOption[]; total: number | null }
  | { success: false; error: string }
> {
  const api = await getAuthorizedApiClient();
  if (!api) {
    return { success: false, error: 'Not connected to Alibaba. Complete OAuth on the Settings page.' };
  }

  const q = query.trim();
  const collected: ProductSearchOption[] = [];

  try {
    if (/^\d{10,}$/.test(q)) {
      const byId = await api.searchProductsV2({ page: 1, pageSize: 30, productId: q });
      collected.push(
        ...AlibabaAPI.extractProductListV2(byId).map((p) => listRowToSearchOption(p as Record<string, unknown>))
      );
      if (!collected.some((p) => p.productId === q)) {
        try {
          const detail = AlibabaAPI.extractProductInfoV2(await api.getProductV2(q));
          if (detail) {
            collected.unshift(listRowToSearchOption({ ...detail, id: q, product_id: q }));
          }
        } catch {
          /* missed */
        }
      }
    } else if (q.length >= 2) {
      const res = await api.searchProductsV2({ page: 1, pageSize: 30, subject: q });
      collected.push(
        ...AlibabaAPI.extractProductListV2(res).map((p) => listRowToSearchOption(p as Record<string, unknown>))
      );
    }

    let alibabaTotal: number | null = null;
    if (!q || q.length < 2) {
      if (!/^\d{10,}$/.test(q)) {
        const res = await api.searchProductsV2({ page: 1, pageSize: 30 });
        collected.push(
          ...AlibabaAPI.extractProductListV2(res).map((p) => listRowToSearchOption(p as Record<string, unknown>))
        );
        alibabaTotal = AlibabaAPI.extractTotalV2(res);
      }
    }

    const products = dedupeSearchOptions(collected).filter((p) => p.productId);
    const total =
      alibabaTotal ??
      (q.length >= 2 || /^\d{10,}$/.test(q) ? products.length : null);

    return { success: true, products, total };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

async function fetchSnapshotByProductId(productId: string): Promise<ListingSnapshot> {
  const api = await getAuthorizedApiClient();
  if (!api) {
    throw new Error('Not connected to Alibaba. Complete OAuth on the Settings page.');
  }

  try {
    const getRes = await api.getProductV2(productId);
    const productInfo = AlibabaAPI.extractProductInfoV2(getRes);
    if (productInfo) {
      return buildListingSnapshotV2(productId, productInfo);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/not.?found|B_PRODUCT/i.test(msg)) throw err;
  }

  const catId = categoryIdForProduct(productId);
  try {
    const draftXml = await api.renderDraftProductSchema(productId, catId);
    return buildListingSnapshotFromSchemaXml(productId, draftXml, String(catId));
  } catch {
    const publishedXml = await api.renderProductSchema(productId, catId);
    return buildListingSnapshotFromSchemaXml(productId, publishedXml, String(catId));
  }
}

export async function compareListingsByProductIdAction(
  leftProductId: string,
  rightProductId: string
): Promise<
  { success: true; result: ListingCompareResult } | { success: false; error: string }
> {
  const leftId = leftProductId.trim();
  const rightId = rightProductId.trim();

  if (!leftId || !rightId) {
    return { success: false, error: 'Enter two product IDs to compare.' };
  }
  if (leftId === rightId) {
    return { success: false, error: 'Choose two different product IDs.' };
  }

  try {
    const [left, right] = await Promise.all([
      fetchSnapshotByProductId(leftId),
      fetchSnapshotByProductId(rightId),
    ]);

    const rows = compareListingSnapshotsV2(left, right);
    const differenceCount = rows.filter((r) => r.status !== 'same').length;

    const summary: ListingCompareSummary = {
      leftProductId: leftId,
      rightProductId: rightId,
      leftSubject: left.subject,
      rightSubject: right.subject,
      leftDescriptionChars: left.descriptionHtml.length,
      rightDescriptionChars: right.descriptionHtml.length,
      leftImageCount: left.images.length,
      rightImageCount: right.images.length,
    };

    return {
      success: true,
      result: { left, right, rows, summary, differenceCount },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
