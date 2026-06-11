/**
 * Probe pageData sources and write paths for smart-editor descriptions.
 * Usage: npx tsx scripts/probe-description-pagedata.ts [sourceId] [cloneId]
 */
import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';
import { parseSmartEditorDescription } from '../src/lib/listing-v2-normalizer';

const OUT = path.join(process.cwd(), 'scratch', 'description-probe');

function walkForPageData(obj: unknown, prefix = '', hits: string[] = []): string[] {
  if (obj == null) return hits;
  if (typeof obj === 'string') {
    if (obj.includes('pageData') || (obj.startsWith('{') && obj.includes('"pageId"'))) {
      hits.push(`${prefix} (string len ${obj.length})`);
    }
    return hits;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkForPageData(v, `${prefix}[${i}]`, hits));
    return hits;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (/pageData|pageId|staticResource|description|multilang|superText|decorate/i.test(k)) {
        const len = typeof v === 'string' ? v.length : JSON.stringify(v).length;
        hits.push(`${prefix}.${k} (${typeof v}, len ${len})`);
      }
      walkForPageData(v, `${prefix}.${k}`, hits);
    }
  }
  return hits;
}

function searchXml(xml: string): Record<string, boolean | number> {
  const terms = [
    'pageData',
    'pageId',
    'staticResource',
    'multilangInfo',
    'multilang',
    'smartDesc',
    'detail_decorate',
    'detailDecorate',
    'magic-global',
    'productDescType',
    'superText',
  ];
  const out: Record<string, boolean | number> = {};
  for (const t of terms) {
    const idx = xml.indexOf(t);
    out[t] = idx >= 0 ? idx : false;
  }
  const fieldIds = [...xml.matchAll(/<field id="([^"]+)"/g)].map((m) => m[1]);
  out['_fieldCount'] = fieldIds.length;
  out['_descFields'] = fieldIds.filter((id) =>
    /desc|super|page|magic|multilang|decorate|smart|detail|template/i.test(id)
  ).length;
  return out;
}

async function main() {
  const sourceId = process.argv[2] || '1601808030041';
  const cloneId = process.argv[3] || '10000043624787';
  const catId = 100009031;

  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('Not authenticated');

  fs.mkdirSync(OUT, { recursive: true });

  const getSource = await api.getProductV2(sourceId);
  const getClone = await api.getProductV2(cloneId);
  fs.writeFileSync(path.join(OUT, `get-v2-source-${sourceId}.json`), JSON.stringify(getSource, null, 2));
  fs.writeFileSync(path.join(OUT, `get-v2-clone-${cloneId}.json`), JSON.stringify(getClone, null, 2));

  const sourceInfo = AlibabaAPI.extractProductInfoV2(getSource)!;
  const descParsed = parseSmartEditorDescription(
    (sourceInfo.basic_info as { description?: unknown }).description
  ) as Record<string, unknown>;

  console.log('\n=== get/v2 description keys ===');
  if (descParsed && typeof descParsed === 'object') {
    for (const [k, v] of Object.entries(descParsed)) {
      const len = typeof v === 'string' ? v.length : JSON.stringify(v).length;
      console.log(`  ${k}: ${typeof v}, len ${len}`);
    }
  }

  console.log('\n=== pageData-like paths in full get/v2 source response ===');
  console.log(walkForPageData(getSource).join('\n') || '  (none)');

  const schemaSource = await api.renderProductSchema(sourceId, catId);
  const schemaClone = await api.renderProductSchema(cloneId, catId);
  fs.writeFileSync(path.join(OUT, `schema-source-${sourceId}.xml`), schemaSource);
  fs.writeFileSync(path.join(OUT, `schema-clone-${cloneId}.xml`), schemaClone);

  console.log('\n=== schema/render term search (source) ===');
  console.log(searchXml(schemaSource));
  console.log('\n=== schema/render term search (clone) ===');
  console.log(searchXml(schemaClone));

  const descFieldIds = [...schemaSource.matchAll(/<field id="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => /desc|super|page|magic|multilang|decorate|smart|detail|template|lang/i.test(id));
  console.log('\n=== description-related field ids in source schema ===');
  console.log(descFieldIds.join(', ') || '(none)');

  console.log(`\nWrote probes to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
