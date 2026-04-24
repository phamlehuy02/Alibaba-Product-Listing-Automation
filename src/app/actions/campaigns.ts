'use server';

import { Campaign, CampaignManager } from '@/lib/campaign-manager';
import { revalidatePath } from 'next/cache';

export async function saveCampaignAction(formData: any) {
  const campaign: Campaign = {
    id: Date.now().toString(),
    name: formData.title || 'Untitled Campaign',
    template: formData,
    schedule: '0 9 * * *', // Default 9 AM
    active: true,
  };

  CampaignManager.saveCampaign(campaign);
  revalidatePath('/');
  return { success: true };
}

export async function getCampaignsAction() {
  return CampaignManager.getCampaigns();
}

export async function toggleCampaignAction(id: string) {
  const campaigns = CampaignManager.getCampaigns();
  const campaign = campaigns.find(c => c.id === id);
  if (campaign) {
    campaign.active = !campaign.active;
    CampaignManager.saveCampaign(campaign);
  }
  revalidatePath('/');
}
