import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'fs';
import path from 'path';
import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('no api');

  const search = await api.searchProductsV2({ page: 1, pageSize: 1 });
  const list = AlibabaAPI.extractProductListV2(search);
  const productId = AlibabaAPI.getProductId(list[0]);
  console.log('productId', productId, 'title', AlibabaAPI.getProductTitle(list[0]));

  const getRes = await api.getProductV2(productId);
  const outDir = path.join(process.cwd(), 'scratch/v2-samples');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `get-v2-${productId}.json`), JSON.stringify(getRes, null, 2));
  console.log('get keys', Object.keys(getRes));
  const info = AlibabaAPI.extractProductInfoV2(getRes);
  console.log('product_info keys', info ? Object.keys(info) : null);

  // dry-run listing payload shape only (don't post unless --post flag)
  if (process.argv.includes('--post') && info) {
    const clone = JSON.parse(JSON.stringify(info));
    delete (clone as any).basic_info?.product_id;
    const title = AlibabaAPI.getProductTitle(clone);
    if ((clone as any).basic_info) (clone as any).basic_info.subject = `TEST ${title}`.slice(0, 128);
    const createRes = await api.createListingV2({
      product_info: clone,
      ai_optimization_config: {
        title_optimization_enabled: true,
        description_optimization_enabled: true,
        keyword_optimization_enabled: true,
      },
    });
    fs.writeFileSync(path.join(outDir, 'listing-v2-response.json'), JSON.stringify(createRes, null, 2));
    console.log('listing response', JSON.stringify(createRes).substring(0, 500));
  }
}

main().catch(console.error);
