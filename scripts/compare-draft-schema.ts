/**
 * Compare source vs draft listings via schema render APIs.
 * Usage: npx tsx scripts/compare-draft-schema.ts [sourceId] [cloneId...]
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'fs';
import path from 'path';
import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';

const CAT_ID = 100009031;

async function renderSource(api: AlibabaAPI, productId: string): Promise<string> {
  return api.renderProductSchema(productId, CAT_ID);
}

async function renderDraft(api: AlibabaAPI, productId: string): Promise<string> {
  return api.renderDraftProductSchema(productId, CAT_ID);
}

function fieldSummary(xml: string, fieldId: string): string {
  const idx = xml.indexOf(`id="${fieldId}"`);
  if (idx < 0) return '—';
  const slice = xml.slice(idx, idx + 6000);
  const values = [...slice.matchAll(/<value([^>]*)>([\s\S]*?)<\/value>/g)];
  if (!values.length) return slice.includes('<complex-value>') ? '[complex]' : '[empty]';
  return values
    .slice(0, 3)
    .map((m) => {
      const attrs = m[1].trim();
      const text = m[2].replace(/&amp;/g, '&').replace(/\s+/g, ' ').slice(0, 80);
      return (attrs ? `(${attrs}) ` : '') + text;
    })
    .join(' | ');
}

async function main() {
  const sourceId = process.argv[2] || '1601807768487';
  const cloneIds = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['10000043612514', '10000043657263', '10000043668001'];

  const outDir = path.join(process.cwd(), 'scratch/v2-samples');
  fs.mkdirSync(outDir, { recursive: true });

  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not connected to Alibaba');

  const sourceXml = await renderSource(api, sourceId);
  fs.writeFileSync(path.join(outDir, `schema-render-source-${sourceId}.xml`), sourceXml);
  console.log(`\nSOURCE ${sourceId} (schema/render)`);
  for (const f of [
    'productTitle',
    'productKeywords_0',
    'productDescType',
    'superText',
    'marketMinOrderQuantity',
    'marketSamplingQuantity',
    'marketSamplingPrice',
    'scImages_0',
    'ladderPrice_0',
    'paymentMethod',
    'logisticSelection',
  ]) {
    console.log(`  ${f}: ${fieldSummary(sourceXml, f)}`);
  }

  for (const cloneId of cloneIds) {
    const draftXml = await renderDraft(api, cloneId);
    fs.writeFileSync(path.join(outDir, `schema-render-draft-${cloneId}.xml`), draftXml);
    console.log(`\nDRAFT ${cloneId} (schema/render/draft)`);
    if (!draftXml) {
      console.log('  (empty — draft missing or API error)');
      continue;
    }
    for (const f of [
      'productTitle',
      'productKeywords_0',
      'productDescType',
      'superText',
      'marketMinOrderQuantity',
      'marketSamplingQuantity',
      'marketSamplingPrice',
      'scImages_0',
      'ladderPrice_0',
      'paymentMethod',
      'logisticSelection',
    ]) {
      const src = fieldSummary(sourceXml, f);
      const drf = fieldSummary(draftXml, f);
      const mark = src === drf ? '=' : '≠';
      console.log(`  ${mark} ${f}:`);
      if (mark === '≠') {
        console.log(`      source: ${src}`);
        console.log(`      draft:  ${drf}`);
      } else {
        console.log(`      ${drf.slice(0, 100)}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
