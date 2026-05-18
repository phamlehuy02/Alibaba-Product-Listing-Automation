import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { AutomationEngine } from './src/lib/automation-engine';

async function run() {
  console.log('Manually triggering AutomationEngine.processCampaigns()...');
  await AutomationEngine.processCampaigns();
}

run();
