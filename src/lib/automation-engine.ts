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
          ...tokens,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || tokens.refresh_token,
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

    // Run daily at 9:00 AM
    cron.schedule('0 9 * * *', () => {
      this.processCampaigns();
    });
  }

  static async processCampaigns() {
    console.log('Starting daily listing batch...');
    const campaigns = CampaignManager.getCampaigns().filter(c => c.active);

    if (campaigns.length === 0) {
      console.log('  No active campaigns.');
      return;
    }

    const TARGET_POSTS = 5;
    let successfulPosts = 0;

    for (let i = 0; i < TARGET_POSTS; i++) {
      // Randomly select a campaign for this post
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      
      console.log(`[Post ${i + 1}/${TARGET_POSTS}] Processing variation for: ${campaign.name}`);
      
      const success = await this.executeListing(campaign);
      if (success) {
        successfulPosts++;
      }

      // 5-second delay between posts to prevent rate-limiting
      if (i < TARGET_POSTS - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`🎉 Daily batch complete! Successfully posted ${successfulPosts} products.`);
  }

  private static async fetchDynamicMedia(api: AlibabaAPI, keyword: string) {
    let images: string[] = [];
    let videoId: string | undefined;

    try {
      // 1. Fetch pool of recent images (up to 100)
      const imgResult = await api.listPhotobankImages(1, 100);
      const photoList = imgResult.alibaba_icbu_photobank_list_response?.photo_list?.photo || [];
      
      if (photoList.length > 0) {
        // Shuffle and pick up to 6 random images
        const shuffled = photoList.sort(() => 0.5 - Math.random());
        images = shuffled.slice(0, 6).map((p: any) => p.url);
      }
    } catch (e) {
      console.error('Error fetching dynamic images:', e);
    }

    try {
      // 2. Search for videos matching the keyword
      let vidResult = await api.queryVideos(1, 20, keyword);
      let videoList = vidResult.alibaba_icbu_video_query_response?.video_list?.isv_video_dto || [];

      // 3. Fallback: If no videos match keyword, fetch without keyword
      if (videoList.length === 0) {
        console.log(`No videos found for "${keyword}", fetching generic videos...`);
        vidResult = await api.queryVideos(1, 20);
        videoList = vidResult.alibaba_icbu_video_query_response?.video_list?.isv_video_dto || [];
      }

      if (videoList.length > 0) {
        // Pick 1 random video
        const randomVid = videoList[Math.floor(Math.random() * videoList.length)];
        videoId = randomVid.video_id;
      }
    } catch (e) {
      console.error('Error fetching dynamic video:', e);
    }

    return { images, videoId };
  }

  private static async executeListing(campaign: any): Promise<boolean> {
    try {
      // 1. Generate daily variation using AI
      const optimized = await optimizeProduct(campaign.template, true);

      // 2. Get API client (auto-refreshes token if needed)
      const api = await this.getApiClient();
      if (!api) {
        console.log(`⏭️  Skipping ${campaign.name} — no valid API client.`);
        return false;
      }

      // 3. Fetch dynamic, randomized media
      const keyword = campaign.template.beanVariety || 'Coffee';
      const dynamicMedia = await this.fetchDynamicMedia(api, keyword);

      // Fallback to statically assigned media if dynamic fetch completely fails
      const finalImages = dynamicMedia.images.length > 0 ? dynamicMedia.images : (campaign.images || campaign.template.images || []);
      const finalVideoId = dynamicMedia.videoId || campaign.video_id || campaign.template.videoId;

      console.log(`Injecting ${finalImages.length} images and ${finalVideoId ? '1 video' : 'no video'} for ${campaign.name}`);

      // 4. Post to Alibaba
      const result = await api.addProduct({
        ...campaign.template,
        title: optimized.title,
        description: optimized.description,
        keywords: optimized.keywords,
        images: finalImages,
        videoId: finalVideoId
      });

      console.log(`✅ Listing successful for ${campaign.name}:`, result.msg || 'Success');

      // 5. Update campaign last run
      campaign.lastRun = new Date().toISOString();
      CampaignManager.saveCampaign(campaign);

      return true;

    } catch (error) {
      console.error(`❌ Automation failed for ${campaign.name}:`, error);
      return false;
    }
  }
}
