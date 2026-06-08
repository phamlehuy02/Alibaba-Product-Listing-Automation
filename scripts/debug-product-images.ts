import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';

async function main() {
  const productId = process.argv[2] || '10000043320572';
  const catId = process.argv[3] || '100009031';
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not authenticated');

  const payload = { product_id: productId, language: 'english' };

  console.log('--- /icbu/product/get with product_get_request ---');
  try {
    const r = await (api as any).execute('/icbu/product/get', {
      product_get_request: JSON.stringify(payload),
    });
    const p =
      r?.alibaba_icbu_product_get_response?.product || r?.result?.product || r?.product;
    console.log('product keys:', p ? Object.keys(p) : 'none');
    console.log('main_image:', JSON.stringify(p?.main_image, null, 2)?.slice(0, 1200));
    const parsed = AlibabaAPI.parseMainImages(p);
    console.log('parsed images:', parsed);
  } catch (e: any) {
    console.log('error:', e.message);
  }

  console.log('\n--- schema get ---');
  const xml = await api.getProductSchema(productId, catId);
  const outDir = path.join(process.cwd(), 'scratch');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'debug-schema.xml'), xml);
  console.log('schema length:', xml.length);
  console.log('fileId count:', (xml.match(/fileId="/g) || []).length);
  const snip = xml.match(/<field id="scImages_0"[\s\S]*?<\/field>/);
  console.log('scImages_0:', snip?.[0]?.slice(0, 400));

  console.log('\n--- photobank sample (first group page 1) ---');
  const groups = await api.listPhotobankGroups();
  const groupList =
    groups.alibaba_icbu_photobank_group_list_response?.result?.groups ||
    groups.result?.groups ||
    [];
  if (groupList[0]) {
    const g = groupList[0];
    const imgs = await api.listPhotobankImages(String(g.id), 1, 5);
    const list =
      imgs.alibaba_icbu_photobank_list_response?.photo_list?.photo ||
      imgs.result?.photo_list?.photo ||
      imgs.result?.pagination_query_list?.list ||
      [];
    console.log('group:', g.name, 'sample urls:', list.slice(0, 2).map((x: any) => x.url));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
