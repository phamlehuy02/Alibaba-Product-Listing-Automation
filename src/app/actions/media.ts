'use server';

import { getAuthorizedApiClient } from '@/lib/api-client';

export async function getPhotobankImagesAction(page = 1, pageSize = 20, groupId?: string) {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not authenticated with Alibaba');

  try {
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const groupsResult = await api.listPhotobankGroups();
      const groups = groupsResult.alibaba_icbu_photobank_group_list_response?.result?.groups || 
                     groupsResult.result?.groups || [];
      if (groups.length > 0) {
        targetGroupId = String(groups[0].id);
      } else {
        targetGroupId = '-1';
      }
    }
    const result = await api.listPhotobankImages(targetGroupId, page, pageSize);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getVideosAction(page = 1, pageSize = 10, title?: string) {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not authenticated with Alibaba');

  try {
    const result = await api.queryVideos(page, pageSize, title);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
