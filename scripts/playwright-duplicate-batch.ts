/**
 * Playwright duplicate batch (Seller Center UI).
 * Usage: npx tsx scripts/playwright-duplicate-batch.ts [startISO] [endISO] [count]
 */
import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import { runDuplicateBatchPlaywright } from '../src/lib/playwright-duplicate-batch';

const RESULT_PATH = path.join(process.cwd(), 'scratch', 'last-batch-result.json');

async function main() {
  const startDate = process.argv[2] || '2026-05-26';
  const endDate = process.argv[3] || '2026-06-01';
  const count = Number(process.argv[4] || 5);

  console.log('--- Playwright duplicate batch ---');
  const result = await runDuplicateBatchPlaywright({
    startDate,
    endDate,
    count,
  });

  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
  console.log('---RESULT---');
  console.log(JSON.stringify(result));
  if (!result.success) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
