import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'fs';
import path from 'path';
import { AlibabaAPI } from './alibaba-api';
import { CampaignManager } from './campaign-manager';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'token.json');

async function syncProducts() {
  console.log('🔄 Starting product sync from Alibaba...');
  
  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';

  if (!appKey || !appSecret) {
    console.error('❌ Missing ALIBABA_APP_KEY or ALIBABA_APP_SECRET');
    return;
  }

  let tokens;
  try {
    tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf-8'));
  } catch (e) {
    console.error('❌ Could not read tokens.json. Please ensure you are authenticated first by running "npm run post-now".');
    return;
  }

  if (!tokens || !tokens.access_token) {
    console.error('❌ No access token found in tokens.json');
    return;
  }

  const api = new AlibabaAPI({ 
    appKey, 
    appSecret, 
    accessToken: tokens.access_token, 
    refreshToken: tokens.refresh_token 
  });

  try {
    console.log('📡 Fetching product list from Alibaba...');
    const listResponse = await api.listProducts(1, 10);
    console.log('listResponse:', JSON.stringify(listResponse, null, 2));
    const products = listResponse?.result?.products || listResponse?.alibaba_icbu_product_list_response?.products?.product || [];

    if (products.length === 0) {
      console.log('⚠️ No products found on Alibaba account.');
      return;
    }

    console.log(`✅ Found ${products.length} products. Fetching details...`);
    
    let addedCount = 0;

    for (const p of products) {
      const productId = String(p.id || p.product_id);
      console.log(`- Fetching details for: ${p.subject} (${productId})...`);
      
      try {
        const detailResponse = await api.getProduct(productId);
        const details = detailResponse?.alibaba_icbu_product_get_response?.product;
        
        if (!details) continue;

        let price = '10.00';
        let moq = '100kg';
        
        if (details.sku_info && details.sku_info.sku_list && details.sku_info.sku_list.length > 0) {
            price = details.sku_info.sku_list[0].price || price;
            moq = details.sku_info.sku_list[0].moq || moq;
        }

        const template = {
          title: details.subject || p.subject,
          description: details.description || '',
          price: price,
          moq: moq,
          category: details.category_id || '100009031',
          beanVariety: 'Arabica', 
          origin: 'Vietnam',
          roastLevel: 'Medium',
          processing: 'Washed'
        };

        const images = details.main_image?.images || [];
        const videoId = details.product_video?.video_id;

        const campaign = {
          id: `imported_${productId}`,
          name: p.subject.substring(0, 50),
          template,
          schedule: '0 9 * * *',
          active: false, // Imported products start inactive so you can review them
          images: images.length > 0 ? images : undefined,
          video_id: videoId
        };

        CampaignManager.saveCampaign(campaign);
        addedCount++;
        
      } catch (err) {
         console.error(`❌ Failed to get details for product ${productId}:`, err);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n🎉 Sync complete! Imported ${addedCount} products into your dashboard.`);
    console.log(`👉 Run "npm run dev" to view and activate them on the dashboard!`);

  } catch (error) {
    console.error('❌ Product sync failed:', error);
  }
}

syncProducts();
