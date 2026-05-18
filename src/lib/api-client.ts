import { AlibabaAPI } from './alibaba-api';
import { promises as fs } from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

export async function getAuthorizedApiClient(): Promise<AlibabaAPI | null> {
  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';

  if (!appKey || !appSecret) return null;

  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    const tokens = JSON.parse(data);

    if (!tokens.access_token) return null;

    const api = new AlibabaAPI({
      appKey,
      appSecret,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    // Simple expiry check (similar to automation-engine.ts)
    if (tokens.obtained_at && tokens.expires_in) {
      const obtainedMs = new Date(tokens.obtained_at).getTime();
      const expiresMs = obtainedMs + (tokens.expires_in * 1000);
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer

      if (Date.now() > (expiresMs - bufferMs)) {
        console.log('🔄 Token near expiry, refreshing...');
        const refreshed = await api.refreshToken();
        const newTokens = {
          ...tokens,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || tokens.refresh_token,
          expires_in: refreshed.expires_in,
          obtained_at: new Date().toISOString(),
        };
        await fs.writeFile(TOKENS_FILE, JSON.stringify(newTokens, null, 2), 'utf-8');
      }
    }

    return api;
  } catch (error) {
    console.error('Failed to get authorized API client:', error);
    return null;
  }
}
