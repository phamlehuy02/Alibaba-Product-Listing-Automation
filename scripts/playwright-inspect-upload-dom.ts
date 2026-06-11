/**
 * Dump upload-related DOM on duplicate editor for selector tuning.
 */
import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import { getAuthorizedApiClient } from '../src/lib/api-client';
import {
  closeAlibabaContext,
  ensureSellerCenterSession,
  launchAlibabaContext,
} from '../src/lib/playwright-alibaba-auth';
import {
  clickDuplicateOnSearchResult,
  searchProductById,
  setRearrangedProductName,
} from '../src/lib/playwright-duplicate';

const OUT = path.join(process.cwd(), 'scratch', 'playwright-debug');

async function main() {
  const sourceId = process.argv[2]?.trim() || '1601807770669';
  const api = await getAuthorizedApiClient();
  if (!api) throw new Error('No API client');

  const context = await launchAlibabaContext({ headless: false });
  try {
    const listPage = await ensureSellerCenterSession(context);
    await searchProductById(listPage, sourceId);
    const page = await clickDuplicateOnSearchResult(listPage, sourceId);
    await setRearrangedProductName(page, sourceId, new Set());
    await page.waitForTimeout(3000);

    const uploadBtn = page.locator('[class*="uploadSlot"] button').filter({ hasText: /^upload$/i }).first();
    if (await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadBtn.click();
      await page.waitForTimeout(2000);
    }

    const manifestPath = path.join(process.cwd(), 'scratch/playwright-images', sourceId, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        images: { localPath: string }[];
      };
      const fileInput = page.locator('#struct-scImages input[type="file"], input[name="file"]').first();
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles(manifest.images[0].localPath);
        await page.waitForTimeout(4000);
      }
    }

    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, 'inspect-upload-after-one.png'), fullPage: true });

    const report = await page.evaluate(() => {
      const fileInputs = [...document.querySelectorAll('input[type="file"]')].map((el) => ({
        id: el.id,
        name: (el as HTMLInputElement).name,
        className: el.className,
        parentClass: el.parentElement?.className?.slice(0, 120) ?? '',
        visible: (el as HTMLElement).offsetParent !== null,
      }));

      const scContainers = [...document.querySelectorAll('[class*="scImage"], [id*="scImages"], [class*="uploadedContainer"], [class*="uploadSlot"]')].map(
        (el) => ({
          tag: el.tagName,
          id: el.id,
          className: el.className?.slice(0, 160) ?? '',
          imgCount: el.querySelectorAll('img[src*="/kf/"]').length,
          fileInputCount: el.querySelectorAll('input[type="file"]').length,
        })
      );

      const uploadSlots = [...document.querySelectorAll('[class*="uploadSlot"]')].map((el) => ({
        className: el.className?.slice(0, 120) ?? '',
        imgCount: el.querySelectorAll('img[src*="/kf/"]').length,
        text: (el.textContent ?? '').trim().slice(0, 40),
      }));

      const headings = [...document.querySelectorAll('*')]
        .filter((el) => /^product images$/i.test((el.textContent ?? '').trim()))
        .slice(0, 3)
        .map((el) => ({
          tag: el.tagName,
          className: el.className?.slice(0, 120) ?? '',
          parentClass: el.parentElement?.className?.slice(0, 120) ?? '',
        }));

      const kfImgs = [...document.querySelectorAll('img[src*="/kf/"]')]
        .slice(0, 12)
        .map((el) => ({
          src: (el.getAttribute('src') ?? '').slice(0, 100),
          className: el.className?.slice(0, 80) ?? '',
          parentClass: el.parentElement?.className?.slice(0, 80) ?? '',
        }));

      const uploadTexts = [...document.querySelectorAll('button, a, span, div')]
        .filter((el) => /upload|image bank|photo bank|本地上传/i.test(el.textContent ?? ''))
        .slice(0, 20)
        .map((el) => ({
          tag: el.tagName,
          text: (el.textContent ?? '').trim().slice(0, 60),
          className: el.className?.slice(0, 80) ?? '',
        }));

      return { fileInputs, scContainers, uploadSlots, headings, kfImgs, uploadTexts };
    });

    fs.writeFileSync(path.join(OUT, 'inspect-upload-dom.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await page.waitForTimeout(5000);
  } finally {
    await closeAlibabaContext(context);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
