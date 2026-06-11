import { Campaign } from './campaign-manager';
import { AlibabaAPI } from './alibaba-api';
import type { ProductBriefV2 } from './listing-v2-types';

/** Seller Center "Last updated" column aligns with US Pacific for this account. */
export function getListingPoolTimezone(): string {
  return process.env.LISTING_POOL_TIMEZONE?.trim() || 'America/Los_Angeles';
}

/** Parse Alibaba `gmt_modified` strings (e.g. "2026-06-02 12:00:37 +0800"). */
export function parseAlibabaModifiedMs(value?: string): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Normalize `last_modified_timestamp` (seconds or ms) and string gmt fields to epoch ms. */
export function parseProductModifiedMs(product: ProductBriefV2 | Record<string, unknown>): number {
  const basic = (product as { basic_info?: { last_modified_timestamp?: number } }).basic_info;
  const ts = basic?.last_modified_timestamp;
  if (typeof ts === 'number' && ts > 0) {
    return ts < 1e12 ? ts * 1000 : ts;
  }
  return parseAlibabaModifiedMs(AlibabaAPI.getGmtModified(product as ProductBriefV2));
}

/** Calendar day YYYY-MM-DD in a timezone (matches Seller Center date column). */
export function calendarDayInTimezone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** Inclusive start day, exclusive end day — e.g. 2026-05-26 .. 2026-06-01 → May 26–31. */
export function inModifiedCalendarRange(
  modifiedMs: number,
  start: string,
  end: string,
  timeZone = getListingPoolTimezone()
): boolean {
  if (modifiedMs <= 0) return false;
  const day = calendarDayInTimezone(modifiedMs, timeZone);
  return day >= start && day < end;
}

/** Sort like Manage Products → Last updated (descending). */
export function sortByLastUpdated(campaigns: Campaign[]): Campaign[] {
  return [...campaigns].sort(
    (a, b) => parseAlibabaModifiedMs(b.gmtModified) - parseAlibabaModifiedMs(a.gmtModified)
  );
}

export function formatAlibabaLastUpdated(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatAlibabaProductStatus(status?: string): string {
  if (!status) return '—';
  if (status === 'approved') return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
