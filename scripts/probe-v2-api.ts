/**
 * Probe Product V2 endpoints and save raw JSON to scratch/v2-samples/.
 * Usage: npx tsx scripts/probe-v2-api.ts [productId]
 */
import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';

const OUT_DIR = path.join(process.cwd(), 'scratch', 'v2-samples');

function writeSample(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Wrote ${file}`);
}

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Not authenticated. Complete OAuth first.');
    process.exit(1);
  }

  const searchRes = await api.searchProductsV2({
    page: 1,
    pageSize: 5,
    gmtModifiedFrom: '2026-05-26 00:00:00',
    gmtModifiedTo: '2026-06-01 00:00:00',
  });
  writeSample('search-v2-date-range', searchRes);

  const products = AlibabaAPI.extractProductListV2(searchRes);
  console.log(`search/v2 returned ${products.length} product(s)`);
  if (products.length) {
    console.log('First:', JSON.stringify(products[0], null, 2).substring(0, 400));
  }

  const productId =
    process.argv[2] ||
    (products.length ? AlibabaAPI.getProductId(products[0]) : '');

  if (!productId) {
    console.warn('No productId for get/v2 probe');
    return;
  }

  const getRes = await api.getProductV2(productId);
  writeSample(`get-v2-${productId}`, getRes);

  const info = AlibabaAPI.extractProductInfoV2(getRes);
  console.log('product_info keys:', info ? Object.keys(info).join(', ') : 'none');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
