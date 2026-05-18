import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export interface Campaign {
  id: string;
  name: string;
  template: any;
  schedule: string;
  active: boolean;
  lastRun?: string;
  images?: string[];
  video_id?: string;
}

const CAMPAIGNS_FILE = path.join(process.cwd(), 'campaigns.json');

/**
 * Seed data for first run. Written to campaigns.json if it doesn't exist.
 */
const SEED_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Arabica Premium Roast',
    active: true,
    schedule: '0 9 * * *',
    lastRun: '2024-04-23T09:00:00Z',
    template: {
      title: 'Premium Arabica Coffee Beans - Medium Roast',
      description: 'High-quality arabica beans sourced from volcanic soil.',
      price: '15.00',
      moq: '100kg',
      category: '100009031'
    }
  },
  {
    id: '2',
    name: 'Robusta Bulk Export',
    active: false,
    schedule: '0 10 * * *',
    lastRun: '2024-04-22T10:00:00Z',
    template: {
      title: 'Strong Robusta Coffee - Bulk Supply',
      description: 'Perfect for espresso blends and instant coffee production.',
      price: '12.00',
      moq: '500kg',
      category: '100009031'
    }
  }
];

export class CampaignManager {
  private static loadCampaigns(): Campaign[] {
    try {
      if (existsSync(CAMPAIGNS_FILE)) {
        const raw = readFileSync(CAMPAIGNS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error('Failed to load campaigns.json, using seed data:', error);
    }
    // First run — write seed data
    CampaignManager.writeCampaigns(SEED_CAMPAIGNS);
    return [...SEED_CAMPAIGNS];
  }

  private static writeCampaigns(campaigns: Campaign[]) {
    writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf-8');
  }

  static getCampaigns(): Campaign[] {
    return this.loadCampaigns();
  }

  static saveCampaign(campaign: Campaign) {
    const campaigns = this.loadCampaigns();
    const index = campaigns.findIndex(c => c.id === campaign.id);
    if (index !== -1) {
      campaigns[index] = campaign;
    } else {
      campaigns.push(campaign);
    }
    this.writeCampaigns(campaigns);
    console.log(`Campaign ${campaign.name} saved.`);
  }
}
