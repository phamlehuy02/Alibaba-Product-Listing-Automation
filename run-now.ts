import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { AutomationEngine } from './src/lib/automation-engine';

async function run() {
  console.log('--- Manual listing batch (CLI) ---');
  const result = await AutomationEngine.runListingBatch();
  console.log(result);
  if (!result.success) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
