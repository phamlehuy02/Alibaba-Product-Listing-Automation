import { Campaign } from './campaign-manager';

/** Parse Alibaba `gmt_modified` strings (e.g. "2026-06-02 12:00:37 +0800"). */
export function parseAlibabaModifiedMs(value?: string): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
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
