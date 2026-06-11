import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import type { ListingSnapshot } from './listing-v2-compare';

export interface CampaignTemplate {
  title: string;
  description: string;
  price: string | number;
  moq: string | number;
  category: string | number;
  productType?: 'green-beans' | 'roasted-beans' | 'ground-coffee' | 'drip-bag';
  // Coffee-specific attributes
  beanVariety?: string;         // e.g. "Arabica", "Robusta"
  origin?: string;              // e.g. "Vietnam", "Ethiopia"
  roastLevel?: string;          // e.g. "Medium", "Dark"
  processing?: string;          // e.g. "Washed", "Natural"
  // Quality & compliance attributes
  certifications?: string[];    // e.g. ["ISO 22000", "HACCP", "Organic"]
  grade?: string;               // e.g. "Grade 1", "A+"
  packagingType?: string;       // e.g. "Vacuum Bag", "Jute Bag"
  shelfLife?: string;           // e.g. "24 months"
  moisture?: string;            // e.g. "< 12.5%"
  altitude?: string;            // e.g. "1200–1800m above sea level"
  // Brand
  brandName?: string;           // e.g. "Detech Coffee"
  // Tiered pricing (maps to ladderPrice_0..3 in schema)
  priceTiers?: Array<{
    minQty: number;   // minimum order quantity for this price tier
    price: number;    // price per unit (USD)
  }>;
  // Free-form key/value product details (maps to customMoreProperty_0..N)
  customAttributes?: Array<{
    propName: string;   // e.g. "Altitude"
    valueName: string;  // e.g. "1200-1800m above sea level"
  }>;
  // Base product reference
  baseProductId?: string;
}


export interface Campaign {
  id: string;
  name: string;
  template: CampaignTemplate;
  active: boolean;
  lastRun?: string;
  /** Pre-stored CDN image URLs from an existing/imported Alibaba product */
  images?: string[];
  /** Pre-stored Alibaba video ID */
  video_id?: string;
  /** From Alibaba list API — last modified on platform */
  gmtModified?: string;
  /** Alibaba approval/display status (e.g. approved) */
  alibabaStatus?: string;
  /** Raw list row preserved for debugging / future fields */
  alibabaListSnapshot?: Record<string, unknown>;
  /** Full listing data fetched from Alibaba + local edits (listing editor) */
  listingSnapshot?: ListingSnapshot;
}

const CAMPAIGNS_FILE = path.join(process.cwd(), 'campaigns.json');

export class CampaignManager {
  private static loadCampaigns(): Campaign[] {
    try {
      if (existsSync(CAMPAIGNS_FILE)) {
        const raw = readFileSync(CAMPAIGNS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('Failed to load campaigns.json:', error);
    }
    return [];
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

  static replaceCampaigns(campaigns: Campaign[]) {
    this.writeCampaigns(campaigns);
  }
}
