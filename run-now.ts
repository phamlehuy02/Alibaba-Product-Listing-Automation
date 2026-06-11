import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { runListingBatch } from './src/lib/run-listing-batch';

async function run() {
  console.log('--- Listing duplicate batch (CLI) ---');
  const result = await runListingBatch({
    startDate: process.argv[2] || '2026-05-26',
    endDate: process.argv[3] || '2026-06-01',
    count: Number(process.argv[4] || 5),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
