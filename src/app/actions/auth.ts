'use server';

import { AlibabaAPI } from '@/lib/alibaba-api';
import { revalidatePath } from 'next/cache';

export async function exchangeTokenAction(code: string) {
  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';
  const redirectUri = process.env.ALIBABA_REDIRECT_URI || '';

  if (!appKey || !appSecret) {
    throw new Error('Alibaba App Key or App Secret not configured in environment variables.');
  }

  const api = new AlibabaAPI({
    appKey,
    appSecret,
    accessToken: '',
    refreshToken: '',
  });

  try {
    const result = await api.exchangeCodeForToken(code, redirectUri);
    
    if (result.access_token) {
      // In a real application, you would save these to a database
      // For now, we return them to the UI so the user can see them
      revalidatePath('/settings');
      return { success: true, data: result };
    } else {
      return { success: false, error: result.error_description || result.msg || 'Unknown error' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
