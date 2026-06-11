/**
 * Try V2 endpoints on /rest base (v2 is in path, not /rest/2.0 prefix).
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import CryptoJS from 'crypto-js';
import fs from 'fs';

function sign(apiPath: string, params: Record<string, string>, secret: string) {
  const sortedKeys = Object.keys(params).sort();
  let signStr = apiPath;
  for (const key of sortedKeys) {
    if (key !== 'sign' && params[key]) signStr += key + params[key];
  }
  return CryptoJS.HmacSHA256(signStr, secret).toString(CryptoJS.enc.Hex).toUpperCase();
}

async function post(label: string, apiPath: string, biz: Record<string, string>, withMethod: boolean) {
  const appKey = process.env.ALIBABA_APP_KEY!;
  const appSecret = process.env.ALIBABA_APP_SECRET!;
  const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));

  const allParams: Record<string, string> = {
    app_key: appKey,
    format: 'json',
    sign_method: 'sha256',
    timestamp: Date.now().toString(),
    access_token: tokens.access_token,
    ...biz,
  };
  if (withMethod) allParams.method = apiPath;

  const body = new URLSearchParams({ ...allParams, sign: sign(apiPath, allParams, appSecret) }).toString();
  const url = `https://openapi-api.alibaba.com/rest${apiPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Protocol': 'GOP',
    },
    body,
  });
  const text = await res.text();
  console.log(`\n[${label}] method=${withMethod}`);
  console.log(text.substring(0, 400));
}

async function main() {
  const searchPath = '/alibaba/icbu/product/search/v2';
  const searchBiz = { current_page: '1', page_size: '3', language: 'ENGLISH' };
  await post('search GOP+method', searchPath, searchBiz, true);
  await post('search GOP no method', searchPath, searchBiz, false);

  // get first product id from search
  const appKey = process.env.ALIBABA_APP_KEY!;
  const appSecret = process.env.ALIBABA_APP_SECRET!;
  const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));
  const allParams: Record<string, string> = {
    app_key: appKey,
    format: 'json',
    sign_method: 'sha256',
    timestamp: Date.now().toString(),
    access_token: tokens.access_token,
    method: searchPath,
    ...searchBiz,
  };
  const searchRes = await fetch(`https://openapi-api.alibaba.com/rest${searchPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Protocol': 'GOP' },
    body: new URLSearchParams({ ...allParams, sign: sign(searchPath, allParams, appSecret) }).toString(),
  });
  const searchJson = await searchRes.json();
  const first = searchJson?.product_info?.[0];
  const productId = String(first?.product_id ?? first?.id ?? '');
  console.log('\nFirst product id:', productId);

  if (productId) {
    const getPath = '/alibaba/icbu/product/get/v2';
    await post('get GOP+method', getPath, { product_id: productId, language: 'ENGLISH' }, true);
    await post('get path param', `/alibaba/icbu/product/get/v2/${productId}`, { language: 'ENGLISH' }, true);
  }
}

main();
