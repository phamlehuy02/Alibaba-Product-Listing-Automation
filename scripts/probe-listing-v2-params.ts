import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import CryptoJS from 'crypto-js';
import fs from 'fs';
import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';
import { rearrangeTitleMinimal } from '../src/lib/title-rearranger';

function sign(apiPath: string, params: Record<string, string>, secret: string) {
  const sortedKeys = Object.keys(params).sort();
  let signStr = apiPath;
  for (const key of sortedKeys) {
    if (key !== 'sign' && params[key]) signStr += key + params[key];
  }
  return CryptoJS.HmacSHA256(signStr, secret).toString(CryptoJS.enc.Hex).toUpperCase();
}

async function loadInfo() {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('no api');
  const search = await api.searchProductsV2({ page: 1, pageSize: 1 });
  const productId = AlibabaAPI.getProductId(AlibabaAPI.extractProductListV2(search)[0]);
  const info = JSON.parse(JSON.stringify(AlibabaAPI.extractProductInfoV2(await api.getProductV2(productId))));
  delete info.basic_info.product_id;
  delete info.basic_info.keywords;
  info.basic_info.subject = rearrangeTitleMinimal(AlibabaAPI.getProductTitle(info), productId).title;
  return info;
}

async function post(label: string, buildParams: (info: any) => Record<string, string>) {
  const info = await loadInfo();
  const apiPath = '/alibaba/icbu/product/listing/v2';
  const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));
  const allParams: Record<string, string> = {
    app_key: process.env.ALIBABA_APP_KEY!,
    format: 'json',
    sign_method: 'sha256',
    timestamp: Date.now().toString(),
    access_token: tokens.access_token,
    method: apiPath,
    ...buildParams(info),
  };

  const res = await fetch(`https://openapi-api.alibaba.com/rest${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Protocol': 'GOP',
    },
    body: new URLSearchParams({
      ...allParams,
      sign: sign(apiPath, allParams, process.env.ALIBABA_APP_SECRET!),
    }).toString(),
  });
  console.log(`\n[${label}]`, (await res.text()).substring(0, 500));
}

async function main() {
  await post('basic_info.product_image rename', (info) => {
    info.basic_info.product_image = info.basic_info.product_images;
    delete info.basic_info.product_images;
    return {
      product_info: JSON.stringify(info),
      ai_optimization_config: JSON.stringify({
        title_optimization_enabled: true,
        description_optimization_enabled: true,
        keyword_optimization_enabled: true,
      }),
    };
  });

  await post('top-level product_image', (info) => ({
    product_info: JSON.stringify(info),
    product_image: JSON.stringify(info.basic_info.product_images),
    ai_optimization_config: JSON.stringify({
      title_optimization_enabled: true,
      description_optimization_enabled: true,
      keyword_optimization_enabled: true,
    }),
  }));

  await post('only listing_request', (info) => ({
    listing_request: JSON.stringify({
      product_info: info,
      product_image: info.basic_info.product_images,
      ai_optimization_config: {
        title_optimization_enabled: true,
        description_optimization_enabled: true,
        keyword_optimization_enabled: true,
      },
    }),
  }));
}

main().catch(console.error);
