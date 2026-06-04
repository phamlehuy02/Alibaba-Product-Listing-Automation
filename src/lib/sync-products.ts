import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from './api-client';
import { syncCampaignsFromAlibaba } from './sync-campaigns';

async function syncProducts() {
  console.log('🔄 Starting product sync from Alibaba...');

  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';

  if (!appKey || !appSecret) {
    console.error('❌ Missing ALIBABA_APP_KEY or ALIBABA_APP_SECRET');
    return;
  }

  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('❌ No access token found. Connect your account on the Settings page first.');
    return;
  }

  const result = await syncCampaignsFromAlibaba(api);

  if (result.success) {
    console.log(`\n🎉 Sync complete! Imported/updated ${result.count ?? 0} products into your dashboard.`);
    console.log('👉 Run "npm run dev" to view them on the dashboard!');
  } else {
    console.error('❌ Product sync failed:', result.error);
  }
}

syncProducts();
