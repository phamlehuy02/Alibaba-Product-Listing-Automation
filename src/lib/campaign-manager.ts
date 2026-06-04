import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

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
  schedule: string;
  active: boolean;
  lastRun?: string;
  /** Pre-stored CDN image URLs from an existing/imported Alibaba product */
  images?: string[];
  /** Pre-stored Alibaba video ID */
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
      moq: '100',
      category: '100009031',
      beanVariety: 'Arabica',
      origin: 'Vietnam',
      roastLevel: 'Medium',
      processing: 'Washed',
      certifications: ['ISO 22000', 'HACCP'],
      grade: 'Grade 1',
      packagingType: 'Vacuum Bag',
      shelfLife: '24 months',
      moisture: '< 12.5%',
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
      moq: '500',
      category: '100009031',
      beanVariety: 'Robusta',
      origin: 'Vietnam',
      roastLevel: 'Dark',
      processing: 'Natural',
      certifications: ['ISO 22000'],
      grade: 'Grade 1',
      packagingType: 'Jute Bag',
      shelfLife: '18 months',
      moisture: '< 13%',
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
