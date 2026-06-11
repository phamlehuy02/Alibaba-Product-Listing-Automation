/**
 * Verify a source → clone pair (canonical compare, same rules as /compare).
 * Usage: npx tsx scripts/verify-listing-pair.ts <sourceId> <cloneId>
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';
import {
  buildListingSnapshotV2,
  compareListingSnapshotsV2,
} from '../src/lib/listing-v2-compare';
import { canonicalDescriptionForCompare } from '../src/lib/listing-v2-normalizer';

async function main() {
  const sourceId = process.argv[2];
  const cloneId = process.argv[3];
  if (!sourceId || !cloneId) {
    console.error('Usage: npx tsx scripts/verify-listing-pair.ts <sourceId> <cloneId>');
    process.exit(1);
  }

  const api = await getAuthorizedApiClient();
  if (!api) {
    console.error('Not connected to Alibaba API.');
    process.exit(1);
  }

  const sourceInfo = AlibabaAPI.extractProductInfoV2(await api.getProductV2(sourceId));
  const cloneInfo = AlibabaAPI.extractProductInfoV2(await api.getProductV2(cloneId));
  if (!sourceInfo || !cloneInfo) {
    console.error('Could not load one or both products.');
    process.exit(1);
  }

  const left = buildListingSnapshotV2(sourceId, sourceInfo);
  const right = buildListingSnapshotV2(cloneId, cloneInfo);
  const rows = compareListingSnapshotsV2(left, right);
  const diffs = rows.filter((r) => r.status !== 'same');
  const descriptionOnly = process.argv.includes('--description-only');

  const sourceDesc = (sourceInfo.basic_info as { description?: unknown })?.description;
  const cloneDesc = (cloneInfo.basic_info as { description?: unknown })?.description;
  const descCanonMatch =
    canonicalDescriptionForCompare(sourceDesc) === canonicalDescriptionForCompare(cloneDesc);

  console.log(`Source: ${sourceId} — ${AlibabaAPI.getProductTitle(sourceInfo)}`);
  console.log(`Clone:  ${cloneId} — ${AlibabaAPI.getProductTitle(cloneInfo)}`);
  console.log('');
  console.log(`Description (canonical HTML, 30-img cap): ${descCanonMatch ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Compare field diffs: ${diffs.length}`);
  for (const row of diffs) {
    console.log(`  [${row.status}] ${row.path}`);
  }

  if (descriptionOnly) {
    process.exit(descCanonMatch ? 0 : 1);
  }
  process.exit(diffs.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
