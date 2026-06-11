import { getAuthorizedApiClient } from './api-client';
import { getListingPoolTimezone } from './alibaba-product-utils';
import {
  appendListingPairs,
  type DuplicateBatchResult,
  type DuplicatePair,
  fetchProductsInDateRange,
  shuffle,
} from './duplicate-pool';
import {
  closeAlibabaContext,
  ensureSellerCenterSession,
  launchAlibabaContext,
} from './playwright-alibaba-auth';
import { PhotobankIndex } from './listing-v2-normalizer';
import {
  closeDuplicateEditorTabs,
  duplicateProductViaPlaywright,
} from './playwright-duplicate';

export async function runDuplicateBatchPlaywright(options?: {
  startDate?: string;
  endDate?: string;
  count?: number;
  delayMs?: number;
  headless?: boolean;
}): Promise<DuplicateBatchResult> {
  const startDate = options?.startDate ?? '2026-05-26';
  const endDate = options?.endDate ?? '2026-06-01';
  const targetCount = options?.count ?? 5;
  const delayMs = options?.delayMs ?? 5000;

  const api = await getAuthorizedApiClient();
  if (!api) {
    return {
      success: false,
      attempted: 0,
      successful: 0,
      pairs: [],
      failures: [],
      error: 'Alibaba API credentials are not configured (needed for pool + images).',
    };
  }

  // Shuffled pool has unique product IDs — each run picks up to `count` different sources.
  const pool = shuffle(await fetchProductsInDateRange(api, startDate, endDate));

  console.log(
    `Date range ${startDate} .. ${endDate} (${getListingPoolTimezone()} calendar): ${pool.length} product(s) in pool`
  );
  if (!pool.length) {
    return {
      success: false,
      attempted: 0,
      successful: 0,
      pairs: [],
      failures: [],
      error: `No products found modified between ${startDate} and ${endDate}.`,
    };
  }

  const context = await launchAlibabaContext({ headless: options?.headless });
  const pairs: DuplicatePair[] = [];
  const failures: Array<{ source: string; reason: string }> = [];
  const usedTitles = new Set<string>();
  const photobank = new PhotobankIndex();
  let attempted = 0;

  try {
    const page = await ensureSellerCenterSession(context);

    for (const item of pool) {
      if (pairs.length >= targetCount) break;
      attempted++;
      console.log(`\n[${pairs.length + 1}/${targetCount}] ${item.title} (${item.id})`);

      try {
        let result = await duplicateProductViaPlaywright(page, item.id, api, usedTitles, {
          photobank,
        });
        if (!result.success) {
          console.log(`  Retry after failure: ${result.error}`);
          await closeDuplicateEditorTabs(page);
          await page.waitForTimeout(2000);
          result = await duplicateProductViaPlaywright(page, item.id, api, usedTitles, {
            photobank,
          });
        }

        if (result.success) {
          const pair: DuplicatePair = {
            source: item.id,
            clone: result.cloneId,
            sourceTitle: result.sourceTitle,
            seedTitle: result.seedTitle,
            cloneTitle: result.seedTitle,
            name: item.title,
            createdAt: new Date().toISOString(),
            isDraft: false,
            method: 'playwright',
            listingMessage: 'Submitted via Seller Center Duplicate product (Playwright)',
          };
          pairs.push(pair);
          console.log(`  ✓ ${pair.source} → ${pair.clone}`);
          console.log(`    title: ${pair.seedTitle}`);
        } else {
          failures.push({ source: item.id, reason: result.error ?? 'Unknown failure' });
          console.log(`  ✗ ${result.error}`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ source: item.id, reason });
        console.log(`  ✗ ${reason}`);
      }

      if (pairs.length < targetCount && attempted < pool.length) {
        await page.waitForTimeout(delayMs);
      }
    }
  } finally {
    await closeAlibabaContext(context);
  }

  if (pairs.length) appendListingPairs(pairs);

  return {
    success: pairs.length > 0,
    attempted,
    successful: pairs.length,
    pairs,
    failures,
    error: pairs.length === 0 ? failures[0]?.reason ?? 'No listings duplicated' : undefined,
  };
}
