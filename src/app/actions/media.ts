'use server';

import { getAuthorizedApiClient } from '@/lib/api-client';

export async function getPhotobankImagesAction(page = 1, pageSize = 20) {
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not authenticated with Alibaba');

  try {
    const result = await api.listPhotobankImages(page, pageSize);
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
