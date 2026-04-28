export interface Campaign {
  id: string;
  name: string;
  template: any;
  schedule: string;
  active: boolean;
  lastRun?: string;
}

export class CampaignManager {
  private static campaigns: Campaign[] = [
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

  static getCampaigns(): Campaign[] {
    return this.campaigns;
  }

  static saveCampaign(campaign: Campaign) {
    const index = this.campaigns.findIndex(c => c.id === campaign.id);
    if (index !== -1) {
      this.campaigns[index] = campaign;
    } else {
      this.campaigns.push(campaign);
    }
    console.log(`Campaign ${campaign.name} saved.`);
  }
}
