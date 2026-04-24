import cron from 'node-cron';
import { CampaignManager } from './campaign-manager';
import { optimizeProduct } from './ai-optimizer';
import { AlibabaAPI } from './alibaba-api';

export class AutomationEngine {
  private static isRunning = false;

  static init() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🚀 Alibaba Automation Engine Started');

    // Default: Check every hour for due campaigns
    cron.schedule('0 * * * *', () => {
      this.processCampaigns();
    });

    // Run once on startup
    this.processCampaigns();
  }

  static async processCampaigns() {
    console.log('Checking campaigns for daily listing...');
    const campaigns = CampaignManager.getCampaigns().filter(c => c.active);

    for (const campaign of campaigns) {
      const now = new Date();
      const lastRun = campaign.lastRun ? new Date(campaign.lastRun) : null;
      
      // If it hasn't run today, run it
      if (!lastRun || lastRun.toDateString() !== now.toDateString()) {
        console.log(`Processing daily listing for: ${campaign.name}`);
        await this.executeListing(campaign);
      }
    }
  }

  private static async executeListing(campaign: any) {
    try {
      // 1. Generate daily variation using AI
      const optimized = await optimizeProduct(campaign.template, true);

      // 2. Refresh tokens if needed (Logic to be added to AlibabaAPI)
      const api = new AlibabaAPI({
        appKey: process.env.ALIBABA_APP_KEY || '',
        appSecret: process.env.ALIBABA_APP_SECRET || '',
        accessToken: process.env.ALIBABA_ACCESS_TOKEN || '',
      });

      // 3. Post to Alibaba
      const result = await api.addProduct({
        ...campaign.template,
        title: optimized.title,
        description: optimized.description,
        keywords: optimized.keywords
      });

      console.log(`✅ Listing successful for ${campaign.name}:`, result.msg || 'Success');

      // 4. Update campaign last run
      campaign.lastRun = new Date().toISOString();
      CampaignManager.saveCampaign(campaign);

    } catch (error) {
      console.error(`❌ Automation failed for ${campaign.name}:`, error);
    }
  }
}
