import cron from 'node-cron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { CampaignManager } from './campaign-manager';
import { optimizeProduct } from './ai-optimizer';
import { AlibabaAPI } from './alibaba-api';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  obtained_at?: string;
}

export class AutomationEngine {
  private static isRunning = false;

  /**
   * Read tokens from tokens.json (persisted by the Settings page).
   */
  private static loadTokens(): StoredTokens | null {
    try {
      if (existsSync(TOKENS_FILE)) {
        return JSON.parse(readFileSync(TOKENS_FILE, 'utf-8'));
      }
    } catch {}
    return null;
  }

  /**
   * Save refreshed tokens back to tokens.json.
   */
  private static saveTokens(tokens: StoredTokens) {
    writeFileSync(TOKENS_FILE, JSON.stringify({
      ...tokens,
      obtained_at: new Date().toISOString(),
    }, null, 2), 'utf-8');
  }

  /**
   * Check if the access token is expired or close to expiring.
   */
  private static isTokenExpired(tokens: StoredTokens): boolean {
    if (!tokens.obtained_at || !tokens.expires_in) return false; // can't tell, assume valid
    const obtainedMs = new Date(tokens.obtained_at).getTime();
    const expiresMs = obtainedMs + (tokens.expires_in * 1000);
    const bufferMs = 10 * 60 * 1000; // refresh 10 minutes before expiry
    return Date.now() > (expiresMs - bufferMs);
  }

  /**
   * Get a valid API client, auto-refreshing the token if needed.
   */
  private static async getApiClient(): Promise<AlibabaAPI | null> {
    const appKey = process.env.ALIBABA_APP_KEY || '';
    const appSecret = process.env.ALIBABA_APP_SECRET || '';

    if (!appKey || !appSecret) return null;

    let tokens = this.loadTokens();
    if (!tokens || !tokens.access_token) {
      console.log('⚠️  No tokens found in tokens.json. Complete OAuth on the Settings page first.');
      return null;
    }

    const api = new AlibabaAPI({ appKey, appSecret, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

    // Auto-refresh if expired
    if (this.isTokenExpired(tokens)) {
      console.log('🔄 Access token expired — refreshing...');
      try {
        const refreshed = await api.refreshToken();
        tokens = {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
        };
        this.saveTokens(tokens);
        console.log('✅ Token refreshed successfully.');
      } catch (error) {
        console.error('❌ Token refresh failed. Re-authorize on the Settings page:', error);
        return null;
      }
    }

    return api;
  }

  static init() {
    if (this.isRunning) return;
    this.isRunning = true;

    const hasAppKeys = process.env.ALIBABA_APP_KEY && process.env.ALIBABA_APP_SECRET;

    if (!hasAppKeys) {
      console.log('⚠️  Automation Engine: Alibaba credentials not configured. Cron scheduler paused.');
      console.log('   Set ALIBABA_APP_KEY and ALIBABA_APP_SECRET in .env.local to enable automation.');
      return;
    }

    const tokens = this.loadTokens();
    if (!tokens || !tokens.access_token) {
      console.log('⚠️  Automation Engine: No access token found. Complete OAuth on the Settings page.');
      console.log('   Cron scheduler will start but skip listings until tokens are available.');
    } else {
      console.log('🚀 Alibaba Automation Engine Started (tokens loaded)');
    }

    // Check every hour for due campaigns
    cron.schedule('0 * * * *', () => {
      this.processCampaigns();
    });
  }

  static async processCampaigns() {
    console.log('Checking campaigns for daily listing...');
    const campaigns = CampaignManager.getCampaigns().filter(c => c.active);

    if (campaigns.length === 0) {
      console.log('  No active campaigns.');
      return;
    }

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

      // 2. Get API client (auto-refreshes token if needed)
      const api = await this.getApiClient();
      if (!api) {
        console.log(`⏭️  Skipping ${campaign.name} — no valid API client.`);
        return;
      }

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
