import { NextRequest, NextResponse } from 'next/server';
import { AlibabaAPI } from '@/lib/alibaba-api';
import { promises as fs } from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

/**
 * OAuth callback handler.
 * Alibaba redirects here with ?code=xxx after the user authorizes.
 * We automatically exchange the code for tokens and redirect to the settings page.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
  }

  const appKey = process.env.ALIBABA_APP_KEY || '';
  const appSecret = process.env.ALIBABA_APP_SECRET || '';

  if (!appKey || !appSecret) {
    return NextResponse.redirect(new URL('/settings?error=no_credentials', request.url));
  }

  try {
    const api = new AlibabaAPI({ appKey, appSecret });
    const result = await api.exchangeCodeForToken(code);

    if (result.access_token) {
      await fs.writeFile(TOKENS_FILE, JSON.stringify({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        resource_owner: result.resource_owner,
        obtained_at: new Date().toISOString(),
      }, null, 2), 'utf-8');

      console.log('✅ Tokens saved via OAuth callback.');
      return NextResponse.redirect(new URL('/settings?success=true', request.url));
    } else {
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(result.message || 'unknown')}`, request.url));
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error.message || 'exchange_failed')}`, request.url));
  }
}
