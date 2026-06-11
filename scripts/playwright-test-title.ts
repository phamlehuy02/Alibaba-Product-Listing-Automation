/**
 * Test duplicate + title rearrange + verify for one source product (no images/submit).
 * Usage: npx tsx scripts/playwright-test-title.ts <sourceProductId>
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import {
  closeAlibabaContext,
  ensureSellerCenterSession,
  launchAlibabaContext,
} from '../src/lib/playwright-alibaba-auth';
import {
  clickDuplicateOnSearchResult,
  searchProductById,
  setRearrangedProductName,
} from '../src/lib/playwright-duplicate';

async function main() {
  const sourceId = process.argv[2]?.trim();
  if (!sourceId) {
    console.error('Usage: npx tsx scripts/playwright-test-title.ts <sourceProductId>');
    process.exit(1);
  }

  const context = await launchAlibabaContext({ headless: false });

  try {
    const listPage = await ensureSellerCenterSession(context);
    await searchProductById(listPage, sourceId);
    const editorPage = await clickDuplicateOnSearchResult(listPage, sourceId);
    await setRearrangedProductName(editorPage, sourceId, new Set());
    console.log('Title rearrange + verify OK.');
    const inspectMs = Number(process.env.PLAYWRIGHT_INSPECT_MS ?? '0');
    if (inspectMs > 0) {
      console.log(`Browser left open for inspection (${inspectMs}ms).`);
      await editorPage.waitForTimeout(inspectMs);
    }
  } finally {
    await closeAlibabaContext(context);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
