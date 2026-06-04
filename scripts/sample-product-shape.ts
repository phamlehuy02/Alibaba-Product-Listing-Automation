import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { extractProductList } from '../src/lib/sync-campaigns';

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('No API');

  const listRes = await api.listProducts(1, 30);
  const products = extractProductList(listRes);
  const root = (listRes as any)?.alibaba_icbu_product_list_response ?? (listRes as any)?.result;

  console.log('=== LIST RESPONSE (metadata only) ===');
  console.log(JSON.stringify({ ...root, products: `[${products.length} items]` }, null, 2));

  console.log('\n=== ONE PRODUCT FROM LIST API ===');
  console.log(JSON.stringify(products[0], null, 2));

  const id = String(products[0]?.id || products[0]?.product_id);
  const detailRes = await api.getProduct(id);
  const detail =
    detailRes?.alibaba_icbu_product_get_response?.product || detailRes?.result?.product;

  console.log('\n=== SAME PRODUCT FROM GET API (top-level keys) ===');
  console.log(JSON.stringify(detail ? Object.keys(detail) : detailRes, null, 2));

  console.log('\n=== GET API PRODUCT (truncated sample) ===');
  if (detail) {
    const sample = {
      ...detail,
      description:
        typeof detail.description === 'string'
          ? `${detail.description.slice(0, 120)}… (${detail.description.length} chars)`
          : detail.description,
    };
    console.log(JSON.stringify(sample, null, 2));
  }
}

main().catch(console.error);
