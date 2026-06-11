/**
 * One-time manual Seller Center login — session persists in .playwright-profile/
 * Usage: npm run playwright-login
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import {
  closeAlibabaContext,
  finalizeLoginSession,
  launchAlibabaContext,
  PROFILE_DIR,
  saveSessionState,
  STORAGE_STATE_PATH,
  verifyPersistedSession,
  waitForManualSellerLogin,
} from '../src/lib/playwright-alibaba-auth';

async function main() {
  console.log(`Profile directory: ${PROFILE_DIR}`);
  console.log('You only need to do this once. Later runs reuse the saved session.\n');

  if (await verifyPersistedSession({ headless: false })) {
    console.log('Session already saved and working — no login needed.');
    console.log('Run: npm run duplicate-playwright');
    return;
  }

  const context = await launchAlibabaContext({ headless: false, forcePersistent: true });
  try {
    const page = await waitForManualSellerLogin(context, { manualMs: 300_000 });
    await finalizeLoginSession(page);
    await saveSessionState(context);
    console.log(`Session saved to ${STORAGE_STATE_PATH}`);
    console.log('Closing browser...');
    await page.waitForTimeout(2000);
  } finally {
    await closeAlibabaContext(context);
  }

  console.log('Verifying session in a fresh browser...');
  const persisted = await verifyPersistedSession({ headless: false });
  if (persisted) {
    console.log('OK — session saved. Future duplicate runs will not ask you to log in again.');
    console.log('Run: npm run duplicate-playwright');
    return;
  }

  console.error('Saved session did not reload. Try logging in again.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
