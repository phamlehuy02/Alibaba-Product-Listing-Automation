'use server';

import { AlibabaAPI } from '@/lib/alibaba-api';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

async function saveTokens(tokens: Record<string, any>) {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log('✅ Tokens saved to tokens.json');
}

export async function getStoredTokens(): Promise<Record<string, any> | null> {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function exchangeTokenAction(code: string) {
  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';

  if (!appKey || !appSecret) {
    throw new Error('Alibaba App Key or App Secret not configured in environment variables.');
  }

  const api = new AlibabaAPI({
    appKey,
    appSecret,
  });

  try {
    const result = await api.exchangeCodeForToken(code);
    
    if (result.access_token) {
      // Persist tokens to disk so the automation engine can use them
      await saveTokens({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        resource_owner: result.resource_owner,
        obtained_at: new Date().toISOString(),
      });

      revalidatePath('/settings');
      return { success: true, data: result };
    } else {
      return { success: false, error: result.error_description || result.msg || 'Unknown error' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
