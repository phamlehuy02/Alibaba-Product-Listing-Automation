'use server';

import { Campaign, CampaignManager } from '@/lib/campaign-manager';
import { getAuthorizedApiClient } from '@/lib/api-client';
import {
  stripPlaceholderCampaigns,
  syncAllCampaignsFromAlibaba,
  syncCampaignsPage,
} from '@/lib/sync-campaigns';
import { getSyncProductLimit } from '@/lib/sync-campaigns';
import { readSyncStatus } from '@/lib/sync-status';
import { AutomationEngine } from '@/lib/automation-engine';
import { revalidatePath } from 'next/cache';

export async function saveCampaignAction(formData: any) {
  const campaign: Campaign = {
    id: Date.now().toString(),
    name: formData.title || 'Untitled Campaign',
    template: formData,
    active: true,
  };

  CampaignManager.saveCampaign(campaign);
  revalidatePath('/');
  return { success: true };
}

export async function getCampaignsAction() {
  const campaigns = CampaignManager.getCampaigns();
  return stripPlaceholderCampaigns(campaigns);
}

export async function getSyncStatusAction() {
  return readSyncStatus();
}

export async function syncCampaignsPageAction(page: number) {
  const api = await getAuthorizedApiClient();
  if (!api) {
    return {
      success: false,
      error: 'Not connected to Alibaba. Complete OAuth on the Settings page.',
    };
  }

  const result = await syncCampaignsPage(api, page);
  revalidatePath('/');
  return result;
}

export async function syncCampaignsAction() {
  const api = await getAuthorizedApiClient();
  if (!api) {
    return { success: false, error: 'Not connected to Alibaba. Complete OAuth on the Settings page.' };
  }

  const result = await syncAllCampaignsFromAlibaba(api);
  revalidatePath('/');
  return result;
}

export async function runListingBatchAction() {
  const result = await AutomationEngine.runListingBatch();
  revalidatePath('/');
  return result;
}

export async function loadCampaignsAction() {
  const api = await getAuthorizedApiClient();
  const rawCampaigns = CampaignManager.getCampaigns();
  let campaigns = stripPlaceholderCampaigns(rawCampaigns);

  if (campaigns.length !== rawCampaigns.length) {
    CampaignManager.replaceCampaigns(campaigns);
  }

  const syncStatus = readSyncStatus();

  return {
    campaigns,
    isAuthenticated: Boolean(api),
    syncStatus,
    syncProductLimit: getSyncProductLimit(),
  };
}

