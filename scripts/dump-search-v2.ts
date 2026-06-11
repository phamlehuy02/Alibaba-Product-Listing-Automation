import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';
import fs from 'fs';
import path from 'path';

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('no api');
  const res = await api.searchProductsV2({
    page: 1,
    pageSize: 2,
    gmtModifiedFrom: '2026-05-26 00:00:00',
    gmtModifiedTo: '2026-06-01 00:00:00',
  });
  const out = path.join(process.cwd(), 'scratch/v2-samples/search-v2-date-range.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log('keys', Object.keys(res));
  const list = AlibabaAPI.extractProductListV2(res);
  console.log('extracted', list.length);
  if (res.product_info?.[0]) {
    console.log('raw[0] keys', Object.keys(res.product_info[0]));
    console.log(JSON.stringify(res.product_info[0], null, 2).substring(0, 2000));
  }
}

main().catch(console.error);
