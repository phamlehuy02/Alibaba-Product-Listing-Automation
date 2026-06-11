import { readFileSync } from 'fs';
import path from 'path';
import {
  rearrangeTitleMinimal,
  validateAlibabaTitle,
  wordsMultisetEqual,
} from '../src/lib/title-rearranger';

const titlesPath = path.join(process.cwd(), 'data', 'catalog-titles.json');
const titles: string[] = JSON.parse(readFileSync(titlesPath, 'utf-8'));
let passed = 0;
let failed = 0;
const unique = [...new Set(titles)];

for (let i = 0; i < unique.length; i++) {
  const source = unique[i];
  const productId = `test_product_${i}`;
  try {
    const result = rearrangeTitleMinimal(source, productId);
    const validation = validateAlibabaTitle(result.title);

    const ok =
      result.title !== source.trim() &&
      wordsMultisetEqual(source, result.title) &&
      validation.ok;

    if (ok) {
      passed++;
      if (i < 3) {
        console.log(`OK [${result.editApplied}]`);
        console.log(`  src: ${source.substring(0, 90)}...`);
        console.log(`  new: ${result.title.substring(0, 90)}...`);
      }
    } else {
      failed++;
      console.error(`FAIL: ${source.substring(0, 70)}`);
      console.error(`  distinct: ${result.title !== source.trim()}`);
      console.error(`  words: ${wordsMultisetEqual(source, result.title)}`);
      console.error(`  valid: ${validation.ok}`, !validation.ok ? validation : '');
    }
  } catch (e) {
    failed++;
    console.error(`ERROR: ${source.substring(0, 70)}`);
    console.error(`  ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\nTitle rearranger: ${passed}/${unique.length} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
