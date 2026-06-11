/**
 * Copy source description HTML onto a clone (schema/update).
 * pageData is read from get/v2 on the source only; Open API cannot restore smart-editor JSON on clones.
 *
 * Usage:
 *   npx tsx scripts/sync-product-description.ts <sourceId> <cloneId>
 *   npx tsx scripts/sync-product-description.ts <sourceId> <cloneId> --dry-run
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { syncCloneDescriptionFromSource } from '../src/lib/description-sync';

async function main() {
  const sourceId = process.argv[2];
  const cloneId = process.argv[3];
  const dryRun = process.argv.includes('--dry-run');

  if (!sourceId || !cloneId) {
    console.error(
      'Usage: npx tsx scripts/sync-product-description.ts <sourceId> <cloneId> [--dry-run]'
    );
    process.exit(1);
  }

  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Not connected to Alibaba API.');
    process.exit(1);
  }

  const result = await syncCloneDescriptionFromSource(api, sourceId, cloneId, { dryRun });
  console.log(JSON.stringify(result, null, 2));

  if (!result.canonicalMatch) {
    process.exit(1);
  }
  if (!result.wireFormatMatch && result.sourceWireFormat === 'smart-json') {
    console.warn(
      '\nNote: Wire-format JSON (smart editing + pageData) cannot be replicated on clones via Open API.',
    );
    console.warn('Canonical HTML content matches; Seller Center will show Custom description mode.');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
