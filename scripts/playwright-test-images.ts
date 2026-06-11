/**
 * Test image manifest + upload + verify for one source product (no submit).
 * Usage: npx tsx scripts/playwright-test-images.ts <sourceProductId>
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { PhotobankIndex } from '../src/lib/listing-v2-normalizer';
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
import { prepareSourceImageManifest } from '../src/lib/playwright-image-prep';
import { uploadProductImagesFromManifest } from '../src/lib/playwright-image-upload';

async function main() {
  const sourceId = process.argv[2]?.trim();
  if (!sourceId) {
    console.error('Usage: npx tsx scripts/playwright-test-images.ts <sourceProductId>');
    process.exit(1);
  }

  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Alibaba API credentials not configured.');
    process.exit(1);
  }

  const photobank = new PhotobankIndex();

  console.log('Preparing image manifest...');
  const manifest = await prepareSourceImageManifest(api, sourceId, { photobank });
  console.log(`Manifest: ${manifest.images.length} image(s) → scratch/playwright-images/${sourceId}/manifest.json`);

  const context = await launchAlibabaContext({ headless: false });

  try {
    const listPage = await ensureSellerCenterSession(context);
    await searchProductById(listPage, sourceId);
    const editorPage = await clickDuplicateOnSearchResult(listPage, sourceId);
    await setRearrangedProductName(editorPage, sourceId, new Set());

    await uploadProductImagesFromManifest(editorPage, manifest);
    console.log('Image upload + verify OK.');
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
