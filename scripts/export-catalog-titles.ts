/**
 * One-time / occasional export of product titles from Alibaba list API.
 * Usage: npx tsx scripts/export-catalog-titles.ts [limit]
 * Default limit: 1000. Output: data/catalog-titles.json (gitignored).
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { extractProductList } from '../src/lib/sync-campaigns';

const limit = Math.min(Number(process.argv[2] || 1000) || 1000, 2000);
const pageSize = 30;

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Not connected to Alibaba. Complete OAuth first.');
    process.exit(1);
  }

  const titles: string[] = [];
  for (let page = 1; titles.length < limit; page++) {
    const res = await api.listProducts(page, pageSize);
    const products = extractProductList(res);
    if (!products.length) break;

    for (const p of products) {
      const t = (p.subject || p.product_name || p.title || '').trim();
      if (t) titles.push(t);
      if (titles.length >= limit) break;
    }

    console.log(`Page ${page}: ${titles.length}/${limit} titles`);
    if (products.length < pageSize) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  const outDir = path.join(process.cwd(), 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'catalog-titles.json');
  writeFileSync(outPath, JSON.stringify(titles, null, 2), 'utf-8');
  console.log(`Saved ${titles.length} titles to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
