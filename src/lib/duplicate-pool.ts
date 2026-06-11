import fs from 'fs';
import path from 'path';
import { AlibabaAPI } from './alibaba-api';
import {
  calendarDayInTimezone,
  getListingPoolTimezone,
  inModifiedCalendarRange,
  parseAlibabaModifiedMs,
  parseProductModifiedMs,
} from './alibaba-product-utils';
import { CampaignManager } from './campaign-manager';
import { extractProductList } from './sync-campaigns';

export const PAIRS_PATH = path.join(process.cwd(), 'scratch', 'listing-pairs.json');

export type DuplicatePair = {
  source: string;
  clone: string;
  sourceTitle: string;
  seedTitle: string;
  cloneTitle?: string;
  aiTitle?: string;
  aiDraftId?: string;
  name?: string;
  createdAt: string;
  isDraft: boolean;
  listingMessage?: string;
  aiOptimizationMessage?: string;
  method: 'schema/draft' | 'schema/publish' | 'playwright';
};

export type DuplicateBatchResult = {
  success: boolean;
  attempted: number;
  successful: number;
  pairs: DuplicatePair[];
  failures: Array<{ source: string; reason: string }>;
  error?: string;
};

export type PoolItem = { id: string; title: string; gmtModified?: string };

const LIST_PAGE_SIZE = 30;
const MAX_LIST_PAGES = 80;

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = 0; i < out.length - 1; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** @deprecated Use inModifiedCalendarRange — kept for older scripts. */
export function inModifiedRangeMs(ms: number, start: string, end: string): boolean {
  return inModifiedCalendarRange(ms, start, end, getListingPoolTimezone());
}

/** @deprecated Use inModifiedCalendarRange */
export function inModifiedRange(gmtModified: string | undefined, start: string, end: string): boolean {
  const ms = parseAlibabaModifiedMs(gmtModified);
  return inModifiedCalendarRange(ms, start, end, getListingPoolTimezone());
}

export function loadProductsFromCampaigns(start: string, end: string): PoolItem[] {
  const tz = getListingPoolTimezone();
  const items: PoolItem[] = [];
  for (const campaign of CampaignManager.getCampaigns()) {
    const ms = parseAlibabaModifiedMs(campaign.gmtModified);
    if (!inModifiedCalendarRange(ms, start, end, tz)) continue;
    const id = campaign.template?.baseProductId || campaign.id.replace(/^imported_/, '');
    if (!id) continue;
    items.push({
      id: String(id),
      title: campaign.name || campaign.template?.title || id,
      gmtModified: campaign.gmtModified,
    });
  }
  return items;
}

/**
 * Products whose Seller Center "Last updated" calendar day falls in [start, end).
 * Uses list API (full catalog, sorted by last updated desc) — search/v2 date filter is unreliable.
 */
export async function fetchProductsInDateRange(
  api: AlibabaAPI,
  start: string,
  end: string
): Promise<PoolItem[]> {
  const tz = getListingPoolTimezone();
  const byId = new Map<string, PoolItem>();

  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const res = await api.listProducts(page, LIST_PAGE_SIZE);
    const batch = extractProductList(res);
    if (!batch.length) break;

    let pastRange = false;
    for (const p of batch) {
      const ms = parseProductModifiedMs(p);
      if (!ms) continue;

      if (calendarDayInTimezone(ms, tz) < start) {
        pastRange = true;
        continue;
      }

      if (!inModifiedCalendarRange(ms, start, end, tz)) continue;

      const id = AlibabaAPI.getProductId(p);
      if (!id) continue;
      byId.set(id, {
        id,
        title: AlibabaAPI.getProductTitle(p),
        gmtModified: AlibabaAPI.getGmtModified(p),
      });
    }

    if (pastRange) break;
    if (batch.length < LIST_PAGE_SIZE) break;
  }

  for (const item of loadProductsFromCampaigns(start, end)) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

export function appendListingPairs(pairs: DuplicatePair[]): void {
  fs.mkdirSync(path.dirname(PAIRS_PATH), { recursive: true });
  let existing: DuplicatePair[] = [];
  if (fs.existsSync(PAIRS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(PAIRS_PATH, 'utf-8'));
    } catch {
      existing = [];
    }
  }
  fs.writeFileSync(PAIRS_PATH, JSON.stringify([...existing, ...pairs], null, 2));
}
