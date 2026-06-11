/**
 * Duplicate random listings in a gmt_modified date range via Product V2 API.
 * Usage: npx tsx scripts/duplicate-v2-batch.ts [startISO] [endISO] [count]
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { runDuplicateBatchV2 } from '../src/lib/product-duplicator';

const startDate = process.argv[2] || '2026-05-26';
const endDate = process.argv[3] || '2026-06-01';
const targetCount = Number(process.argv[4] || 5);

async function main() {
  const result = await runDuplicateBatchV2({
    startDate,
    endDate,
    count: targetCount,
  });

  console.log('\n========== RESULT ==========');
  console.log(`Posted ${result.successful}/${targetCount} (attempted ${result.attempted})`);

  if (result.pairs.length) {
    console.log('\nSource → Clone:');
    for (const p of result.pairs) {
      console.log(`  ${p.source} → ${p.clone}  (${p.sourceTitle})`);
    }
    console.log('\nSaved to scratch/listing-pairs.json');
  }

  if (result.failures.length) {
    console.log('\nFailures:');
    for (const f of result.failures) {
      console.log(`  ${f.source}: ${f.reason}`);
    }
  }

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
