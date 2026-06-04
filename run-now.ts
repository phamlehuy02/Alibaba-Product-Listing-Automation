import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { AutomationEngine } from './src/lib/automation-engine';
import { CampaignManager } from './src/lib/campaign-manager';

async function run() {
  console.log('--- TEST RUN: Automated Alibaba Listing Script (Single Execution) ---');
  const campaigns = CampaignManager.getCampaigns().filter(c => c.active);
  if (campaigns.length === 0) {
    console.error('❌ No active campaigns found in campaigns.json.');
    return;
  }

  // Run the first active campaign (Arabica Catimor S18 Green Coffee Beans)
  const campaign = campaigns[0];
  console.log(`\n🎯 Target Campaign: "${campaign.name}"`);
  console.log(`📝 Template Configuration:`);
  console.log(`   - Title: "${campaign.template.title}"`);
  console.log(`   - Description: "${campaign.template.description || '(Left blank to clone base product description)'}"`);
  console.log(`   - Category ID: ${campaign.template.category}`);
  console.log(`   - Product Type: ${campaign.template.productType}`);
  console.log(`   - MOQ: ${campaign.template.moq}`);
  
  console.log('\n🚀 Starting execution of executeListing...');
  const success = await (AutomationEngine as any).executeListing(campaign);
  
  if (success) {
    console.log('\n✅ Test run completed successfully!');
  } else {
    console.log('\n❌ Test run failed. Check logs above for details.');
  }
}

run().catch(console.error);
