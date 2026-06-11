/**
 * Count duplicate pool size for a modified-date range (Seller Center calendar).
 * Usage: npx tsx scripts/count-pool-range.ts [startISO] [endISO]
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import {
  calendarDayInTimezone,
  getListingPoolTimezone,
  parseAlibabaModifiedMs,
} from '../src/lib/alibaba-product-utils';
import { fetchProductsInDateRange } from '../src/lib/duplicate-pool';

async function main() {
  const start = process.argv[2] || '2026-05-26';
  const end = process.argv[3] || '2026-06-01';
  const tz = getListingPoolTimezone();

  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Not authenticated.');
    process.exit(1);
  }

  const pool = await fetchProductsInDateRange(api, start, end);
  const byDay = new Map<string, number>();
  for (const item of pool) {
    const ms = parseAlibabaModifiedMs(item.gmtModified);
    if (!ms) continue;
    const day = calendarDayInTimezone(ms, tz);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  console.log(`Timezone: ${tz}`);
  console.log(`Range: ${start} .. ${end} (end exclusive)`);
  console.log(`Pool size: ${pool.length}`);
  console.log('By day:', Object.fromEntries([...byDay.entries()].sort()));

  const sample = pool.find((p) => p.id === '11000007057744');
  if (sample) console.log('Includes 11000007057744:', sample.title.slice(0, 60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
