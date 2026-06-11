import { AlibabaAPI } from './alibaba-api';
import { sortByLastUpdated } from './alibaba-product-utils';
import { Campaign, CampaignManager } from './campaign-manager';
import {
  completeSyncStatus,
  failSyncStatus,
  resetSyncStatus,
  writeSyncStatus,
} from './sync-status';

const PLACEHOLDER_IDS = new Set(['1', '2']);
/** Alibaba list API returns at most 30 items per page regardless of requested page_size. */
const DEFAULT_PAGE_SIZE = 30;

/** List API returns products sorted by gmt_modified descending (most recent first). */
export function getSyncProductLimit(): number {
  const n = Number(process.env.SYNC_PRODUCT_LIMIT ?? '100');
  if (Number.isNaN(n) || n < 1) return 100;
  return Math.min(n, 500);
}

export function getSyncRequestDelayMs(): number {
  const n = Number(process.env.SYNC_REQUEST_DELAY_MS ?? '600');
  if (Number.isNaN(n) || n < 200) return 600;
  return Math.min(n, 5000);
}

export function isImportedCampaignId(id: string): boolean {
  return id.startsWith('imported_');
}

export function splitManualAndImported(campaigns: Campaign[]) {
  const manual: Campaign[] = [];
  const imported: Campaign[] = [];
  for (const c of campaigns) {
    if (isImportedCampaignId(c.id)) imported.push(c);
    else manual.push(c);
  }
  return { manual, imported };
}

export function isPlaceholderCampaign(campaign: Campaign): boolean {
  return PLACEHOLDER_IDS.has(campaign.id);
}

export function stripPlaceholderCampaigns(campaigns: Campaign[]): Campaign[] {
  return campaigns.filter((c) => !isPlaceholderCampaign(c));
}

export function hasOnlyPlaceholderCampaigns(campaigns: Campaign[]): boolean {
  return campaigns.length > 0 && campaigns.every(isPlaceholderCampaign);
}

export type SyncCampaignsResult = {
  success: boolean;
  count?: number;
  alibabaTotal?: number | null;
  error?: string;
};

export type SyncPageResult = {
  success: boolean;
  page: number;
  pageSize: number;
  importedThisPage: number;
  totalImported: number;
  alibabaTotal: number | null;
  hasMore: boolean;
  error?: string;
};

export function extractProductList(listResponse: Record<string, unknown> | null | undefined): any[] {
  if (!listResponse) return [];
  const fromResult = (listResponse as any)?.result?.products;
  if (Array.isArray(fromResult) && fromResult.length > 0) return fromResult;
  const fromV2 = AlibabaAPI.extractProductListV2(listResponse);
  if (fromV2.length > 0) return fromV2;
  const fromIcbu =
    (listResponse as any)?.alibaba_icbu_product_list_response?.products?.product;
  if (Array.isArray(fromIcbu)) return fromIcbu;
  if (fromIcbu) return [fromIcbu];
  return [];
}

export function extractTotalFromListResponse(
  listResponse: Record<string, unknown> | null | undefined
): number | null {
  if (!listResponse) return null;
  const fromV2 = AlibabaAPI.extractTotalV2(listResponse);
  if (fromV2 != null) return fromV2;
  const root =
    (listResponse as any)?.alibaba_icbu_product_list_response ??
    (listResponse as any)?.result;
  const candidates = [
    root?.total_item,
    root?.totalItem,
    root?.total,
    root?.total_count,
    root?.products?.total,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function computeHasMore(
  itemsThisPage: number,
  importedCount: number,
  alibabaTotal: number | null,
  importLimit: number
): boolean {
  if (itemsThisPage === 0) return false;
  if (importedCount >= importLimit) return false;
  if (alibabaTotal != null && alibabaTotal > 0) {
    return importedCount < Math.min(alibabaTotal, importLimit);
  }
  return true;
}

function campaignFromListItem(product: any, previous?: Campaign): Campaign {
  const productId = AlibabaAPI.getProductId(product);
  const subject =
    AlibabaAPI.getProductTitle(product) ||
    previous?.template?.title ||
    'Untitled Product';
  const listImages = AlibabaAPI.parseMainImages(product).map((img) => img.url);
  const trade = product.trade_info as { price?: string | number; moq?: string | number } | undefined;

  return {
    id: `imported_${productId}`,
    name: subject.substring(0, 80),
    template: {
      ...previous?.template,
      title: subject,
      description: previous?.template?.description || '',
      price: product.price ?? trade?.price ?? previous?.template?.price ?? '10.00',
      moq: product.moq ?? trade?.moq ?? previous?.template?.moq ?? '100',
      category:
        product.category_id ||
        product.categoryId ||
        product.category_info?.category_id ||
        previous?.template?.category ||
        '100009031',
      baseProductId: productId,
      beanVariety: previous?.template?.beanVariety ?? 'Arabica',
      origin: previous?.template?.origin ?? 'Vietnam',
      roastLevel: previous?.template?.roastLevel ?? 'Medium',
      processing: previous?.template?.processing ?? 'Washed',
    },
    active: true,
    lastRun: previous?.lastRun,
    images: listImages.length > 0 ? listImages : previous?.images,
    video_id: previous?.video_id,
    gmtModified: AlibabaAPI.getGmtModified(product) || previous?.gmtModified,
    alibabaStatus: product.status || product.basic_info?.status || previous?.alibabaStatus,
    alibabaListSnapshot: product,
  };
}

/**
 * Import one page of products (list API only — fast, scales to large catalogs).
 * Alibaba returns rows sorted by `gmt_modified` descending — same as Manage Products
 * with "Last updated" descending (see alibaba.icbu.product.list docs).
 */
export async function syncCampaignsPage(
  api: AlibabaAPI,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
  options?: { importLimit?: number; manualCampaigns?: Campaign[] }
): Promise<SyncPageResult> {
  try {
    const importLimit = options?.importLimit ?? getSyncProductLimit();
    const listResponse = await api.listProducts(page, pageSize);
    const products = extractProductList(listResponse);
    const alibabaTotal = extractTotalFromListResponse(listResponse);

    const manual =
      options?.manualCampaigns ??
      splitManualAndImported(stripPlaceholderCampaigns(CampaignManager.getCampaigns())).manual;

    if (page === 1) {
      CampaignManager.replaceCampaigns(manual);
    }

    const importedById = new Map<string, Campaign>(
      page === 1
        ? []
        : splitManualAndImported(stripPlaceholderCampaigns(CampaignManager.getCampaigns())).imported.map(
            (c) => [c.id, c]
          )
    );

    let importedThisPage = 0;
    for (const product of products) {
      if (importedById.size >= importLimit) break;

      const productId = AlibabaAPI.getProductId(product);
      if (!productId) continue;

      const campaignId = `imported_${productId}`;
      const previous = CampaignManager.getCampaigns().find((c) => c.id === campaignId);
      const isNew = !importedById.has(campaignId);
      importedById.set(campaignId, campaignFromListItem(product, previous));
      if (isNew) importedThisPage++;
    }

    const imported = sortByLastUpdated(Array.from(importedById.values()));
    const allCampaigns = [...manual, ...imported];
    CampaignManager.replaceCampaigns(allCampaigns);

    const hasMore = computeHasMore(
      products.length,
      imported.length,
      alibabaTotal,
      importLimit
    );

    if (!hasMore) {
      completeSyncStatus(imported.length, alibabaTotal);
    } else {
      writeSyncStatus({
        phase: 'listing',
        message: `Importing ${importLimit.toLocaleString()} most recently updated products (${imported.length.toLocaleString()} loaded${
          alibabaTotal ? ` · ${alibabaTotal.toLocaleString()} on Alibaba` : ''
        })…`,
        currentPage: page,
        importedCount: imported.length,
        alibabaTotal,
      });
    }

    return {
      success: true,
      page,
      pageSize,
      importedThisPage,
      totalImported: imported.length,
      alibabaTotal,
      hasMore,
    };
  } catch (error: any) {
    failSyncStatus(error?.message || 'Sync failed');
    return {
      success: false,
      page,
      pageSize,
      importedThisPage: 0,
      totalImported: stripPlaceholderCampaigns(CampaignManager.getCampaigns()).length,
      alibabaTotal: null,
      hasMore: false,
      error: error?.message || 'Sync failed',
    };
  }
}

/**
 * Import all product pages from Alibaba (list summaries only).
 */
export async function syncAllCampaignsFromAlibaba(
  api: AlibabaAPI,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<SyncCampaignsResult> {
  const importLimit = getSyncProductLimit();
  const delayMs = getSyncRequestDelayMs();
  const manual = splitManualAndImported(
    stripPlaceholderCampaigns(CampaignManager.getCampaigns())
  ).manual;

  resetSyncStatus();
  CampaignManager.replaceCampaigns(manual);

  let page = 1;
  let hasMore = true;
  let alibabaTotal: number | null = null;
  let totalImported = 0;

  try {
    while (hasMore) {
      const result = await syncCampaignsPage(api, page, pageSize, {
        importLimit,
        manualCampaigns: manual,
      });
      if (!result.success) {
        return { success: false, error: result.error, count: result.totalImported, alibabaTotal };
      }

      totalImported = result.totalImported;
      alibabaTotal = result.alibabaTotal ?? alibabaTotal;
      hasMore = result.hasMore;
      page++;

      if (result.importedThisPage === 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    completeSyncStatus(totalImported, alibabaTotal);
    return { success: true, count: totalImported, alibabaTotal };
  } catch (error: any) {
    failSyncStatus(error?.message || 'Sync failed');
    return {
      success: false,
      error: error?.message || 'Sync failed',
      count: totalImported,
      alibabaTotal,
    };
  }
}

/** @deprecated Use syncAllCampaignsFromAlibaba — kept for CLI compatibility */
export async function syncCampaignsFromAlibaba(
  api: AlibabaAPI,
  _pageSize = DEFAULT_PAGE_SIZE
): Promise<SyncCampaignsResult> {
  return syncAllCampaignsFromAlibaba(api, DEFAULT_PAGE_SIZE);
}
