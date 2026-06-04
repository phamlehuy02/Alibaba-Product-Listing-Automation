import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import {
  extractProductList,
  extractTotalFromListResponse,
} from '../src/lib/sync-campaigns';

async function main() {
  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('No API client');
    process.exit(1);
  }

  for (const page of [1, 2, 3]) {
    const res = await api.listProducts(page, 50);
    const products = extractProductList(res);
    const total = extractTotalFromListResponse(res);
    const root = (res as any)?.alibaba_icbu_product_list_response ?? (res as any)?.result;
    console.log({ page, products: products.length, total, rootKeys: root ? Object.keys(root) : [] });
    if (products[0]) {
      console.log('  first id', products[0].id || products[0].product_id);
    }
    if (products[products.length - 1]) {
      const last = products[products.length - 1];
      console.log('  last id', last.id || last.product_id);
    }
  }
}

main().catch(console.error);
