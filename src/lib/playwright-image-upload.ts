import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Frame, Locator, Page } from 'playwright';
import { imageBasename } from './listing-v2-normalizer';
import type { ImageManifest, ManifestImage } from './playwright-image-prep';
import { normalizeSourceImageUrl } from './schema-listing-xml';

const DEBUG_DIR = path.join(process.cwd(), 'scratch', 'playwright-debug');
const IMAGES_ROOT = '#struct-scImages, [class*="uploadedContainer"]';

export type ImageSlotObservation = {
  src?: string;
  fileId?: string;
  basename?: string;
};

function searchRoots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames()];
}

async function saveDebug(page: Page, label: string): Promise<void> {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9_-]+/gi, '_');
  await page.screenshot({ path: path.join(DEBUG_DIR, `${safe}.png`), fullPage: true }).catch(() => {});
}

function acceptableBasenames(img: ManifestImage): Set<string> {
  const basenames = new Set<string>();
  basenames.add(imageBasename(normalizeSourceImageUrl(img.sourceUrl)));
  if (img.resolvedUrl) {
    basenames.add(imageBasename(normalizeSourceImageUrl(img.resolvedUrl)));
  }
  return basenames;
}

function acceptableFileIds(img: ManifestImage): Set<string> {
  const ids = new Set<string>();
  if (img.sourceFileId) ids.add(img.sourceFileId);
  if (img.resolvedFileId) ids.add(img.resolvedFileId);
  return ids;
}

function isKfProductSrc(src: string | null | undefined): boolean {
  if (!src || !src.includes('alicdn')) return false;
  if (
    src.includes('imgextra') ||
    src.includes('-tps-') ||
    src.includes('/tfs/') ||
    src.includes('/@img/')
  ) {
    return false;
  }
  return src.includes('/kf/');
}

async function imagesRoot(page: Page): Promise<Locator> {
  for (const root of searchRoots(page)) {
    const loc = root.locator('#struct-scImages').first();
    if ((await loc.count()) > 0) return loc;
    const uploaded = root.locator('[class*="uploadedContainer"]').first();
    if ((await uploaded.count()) > 0) return uploaded;
  }
  return page.locator('#struct-scImages').first();
}

async function readFileIdFromLocator(loc: Locator): Promise<string | undefined> {
  for (const attr of ['data-file-id', 'data-fileid', 'data-id', 'fileid']) {
    const host = loc.locator(`xpath=ancestor-or-self::*[@${attr}][1]`);
    if ((await host.count()) > 0) {
      const value = await host.first().getAttribute(attr);
      if (value && /^\d+$/.test(value)) return value;
    }
  }

  const hidden = loc.locator(
    'xpath=ancestor-or-self::*//input[@type="hidden"][contains(@name,"scImages") or contains(@id,"scImages")][1]'
  );
  if ((await hidden.count()) > 0) {
    const value = await hidden.first().getAttribute('value');
    if (value && /^\d+$/.test(value)) return value;
  }

  return undefined;
}

async function dismissUploadOverlay(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function sha256FromUrl(url: string): Promise<string | null> {
  try {
    const normalized = normalizeSourceImageUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(normalized, { signal: controller.signal });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return createHash('sha256').update(buf).digest('hex');
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function listImageLocators(page: Page): Promise<Locator> {
  const root = await imagesRoot(page);
  return root.locator('[class*="listImage"][src*="/kf/"], img[src*="/kf/"]');
}

async function clickUploadButton(page: Page): Promise<void> {
  const root = await imagesRoot(page);
  await root.scrollIntoViewIfNeeded().catch(() => {});

  const uploadBtn = root
    .locator('[class*="uploadSlot"] button, [class*="uploadSlotBtn"]')
    .filter({ hasText: /^upload$/i })
    .first();

  if (await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await uploadBtn.scrollIntoViewIfNeeded();
    await uploadBtn.click();
    await page.waitForTimeout(1500);
    return;
  }

  const fallback = root.getByRole('button', { name: /^upload$/i }).first();
  if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fallback.scrollIntoViewIfNeeded();
    await fallback.click();
    await page.waitForTimeout(1500);
  }
}

async function findUploadFileInput(page: Page): Promise<Locator | null> {
  for (let attempt = 0; attempt < 15; attempt++) {
    for (const root of searchRoots(page)) {
      const selectors = [
        '#struct-scImages input[type="file"]',
        '[class*="uploadedContainer"] input[type="file"]',
        '.ggs-next-prefix-upload input[type="file"]',
        'input[name="file"]',
      ];
      for (const sel of selectors) {
        const input = root.locator(sel).first();
        if ((await input.count()) > 0) return input;
      }
    }
    await page.waitForTimeout(300);
  }

  return null;
}

async function waitForImageCount(
  page: Page,
  expected: number,
  baseline = 0
): Promise<void> {
  const target = baseline + expected;
  for (let attempt = 0; attempt < 30; attempt++) {
    const slots = await collectMainImageSlots(page);
    if (slots.length >= target) {
      await page.waitForTimeout(800);
      return;
    }
    await page.waitForTimeout(500);
  }
}

/** Duplicate editor pre-fills source images — remove them so uploads replace the set. */
async function clearPrefilledProductImages(page: Page): Promise<number> {
  const root = await imagesRoot(page);
  await root.scrollIntoViewIfNeeded().catch(() => {});
  let cleared = 0;

  for (let round = 0; round < 30; round++) {
    const slots = await collectMainImageSlots(page);
    if (!slots.length) break;

    const wrapper = root.locator('[class*="listImageWrapper"]').first();
    if ((await wrapper.count()) > 0) {
      await wrapper.hover().catch(() => undefined);
      await page.waitForTimeout(400);
    } else {
      const img = root.locator('[class*="listImage"][src*="/kf/"]').first();
      if ((await img.count()) === 0) break;
      await img.hover().catch(() => undefined);
      await page.waitForTimeout(400);
    }

    const deleteBtn = root
      .getByRole('button', { name: /^delete$/i })
      .or(root.locator('[class*="delete"]').filter({ hasText: /^delete$/i }))
      .or(root.getByText(/^delete$/i))
      .first();

    if (!(await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      break;
    }

    await deleteBtn.click();
    await page.waitForTimeout(600);

    const confirm = page
      .getByRole('button', { name: /^ok$|^confirm$|^yes$|^delete$/i })
      .last();
    if (await confirm.isVisible({ timeout: 800 }).catch(() => false)) {
      await confirm.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }

    cleared++;
  }

  if (cleared > 0) {
    console.log(`    Cleared ${cleared} prefilled image(s) before upload`);
  }
  return cleared;
}

async function uploadPickerScope(page: Page): Promise<Locator> {
  for (const root of searchRoots(page)) {
    const modal = root
      .locator('[role="dialog"], [class*="modal"], [class*="dialog"], [class*="picker"]')
      .filter({ has: root.getByText(/image bank|photo bank|photobank|upload image/i) })
      .last();
    if ((await modal.count()) > 0 && (await modal.isVisible({ timeout: 500 }).catch(() => false))) {
      return modal;
    }
  }
  return page.locator('body');
}

async function openPhotobankFromUploadMenu(page: Page): Promise<void> {
  const bankEntry = page
    .getByText(/image bank|photo bank|photobank|图片银行/i)
    .first();
  if (await bankEntry.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bankEntry.click();
    await page.waitForTimeout(1500);
  }
}

async function confirmPicker(page: Page): Promise<void> {
  const scope = await uploadPickerScope(page);
  const confirm = scope.getByRole('button', { name: /confirm|ok|done|select|insert|apply/i }).first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
    await page.waitForTimeout(1500);
  }
}

async function uploadViaDirectSlots(page: Page, manifest: ImageManifest): Promise<boolean> {
  const { images } = manifest;
  const root = await imagesRoot(page);
  await root.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});

  await clearPrefilledProductImages(page);
  const baseline = (await collectMainImageSlots(page)).length;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    console.log(`    Image ${img.sort}/${images.length}: direct upload...`);

    if (i > 0) await dismissUploadOverlay(page);
    await clickUploadButton(page);

    const fileInput = await findUploadFileInput(page);
    if (!fileInput) {
      console.log(`    Image ${img.sort}: no file input after clicking Upload`);
      return false;
    }

    try {
      await fileInput.setInputFiles(img.localPath);
      await waitForImageCount(page, i + 1, baseline);
    } catch {
      return false;
    }
  }

  return true;
}

async function findStrictPhotobankThumb(page: Page, img: ManifestImage): Promise<Locator | null> {
  const scope = await uploadPickerScope(page);
  const fileIds = acceptableFileIds(img);
  const basenames = acceptableBasenames(img);
  const searchTerms = [
    img.uploadFileName.replace(/\.[^.]+$/, ''),
    `listing-${img.sort}`,
    ...fileIds,
    ...basenames,
  ];

  for (const fileId of fileIds) {
    const byAttr = scope.locator(
      `[data-file-id="${fileId}"], [data-id="${fileId}"], [data-fileid="${fileId}"]`
    );
    const n = await byAttr.count();
    for (let i = 0; i < n; i++) {
      const el = byAttr.nth(i);
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    }
  }

  for (const basename of basenames) {
    const bySrc = scope.locator(`img[src*="${basename}"]`);
    const srcCount = await bySrc.count();
    for (let i = 0; i < srcCount; i++) {
      const el = bySrc.nth(i);
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    }
  }

  const search = scope.locator('input[type="search"], input[placeholder*="search" i]').last();
  if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
    for (const term of searchTerms) {
      if (!term) continue;
      await search.fill('');
      await search.fill(term);
      await page.waitForTimeout(1500);

      for (const basename of basenames) {
        const byName = scope.locator(`img[src*="${basename}"]`).first();
        if (await byName.isVisible({ timeout: 2000 }).catch(() => false)) return byName;
      }
    }
  }

  return null;
}

async function uploadViaPhotobank(page: Page, manifest: ImageManifest): Promise<void> {
  for (let i = 0; i < manifest.images.length; i++) {
    const img = manifest.images[i];
    console.log(
      `    Image ${img.sort}/${manifest.images.length}: photobank file_id=${img.resolvedFileId || img.sourceFileId}...`
    );

    await dismissUploadOverlay(page);
    await clickUploadButton(page);
    await openPhotobankFromUploadMenu(page);

    const thumb = await findStrictPhotobankThumb(page, img);
    if (!thumb) {
      const basenameList = [...acceptableBasenames(img)].join(', ');
      throw new Error(
        `No exact photobank match for image ${img.sort} (file_ids=${[...acceptableFileIds(img)].join('|')}, basenames=${basenameList})`
      );
    }

    await thumb.click();
    await page.waitForTimeout(500);
    await confirmPicker(page);
    await waitForImageCount(page, i + 1);
  }
}

/** Read main image slots scoped to Product images (#struct-scImages). */
export async function collectMainImageSlots(page: Page): Promise<ImageSlotObservation[]> {
  for (const root of searchRoots(page)) {
    const container = root.locator('#struct-scImages, [class*="uploadedContainer"]').first();
    if ((await container.count()) === 0) continue;

    const imgs = container.locator('[class*="listImage"][src*="/kf/"], img[src*="/kf/"]');
    const count = await imgs.count();
    const seen = new Set<string>();
    const slots: ImageSlotObservation[] = [];

    for (let i = 0; i < count; i++) {
      const img = imgs.nth(i);
      const src = await img.getAttribute('src');
      if (!isKfProductSrc(src) || !src) continue;

      const basename = imageBasename(normalizeSourceImageUrl(src));
      if (seen.has(basename)) continue;
      seen.add(basename);

      const fileId = await readFileIdFromLocator(img);
      slots.push({ src, fileId, basename });
    }

    if (slots.length > 0) return slots;
  }

  return [];
}

export async function collectMainImageSrcs(page: Page): Promise<string[]> {
  const slots = await collectMainImageSlots(page);
  return slots.map((s) => s.src).filter((s): s is string => Boolean(s));
}

async function slotMatchesManifest(
  slot: ImageSlotObservation,
  img: ManifestImage
): Promise<{ match: boolean; reason?: string }> {
  const fileIds = acceptableFileIds(img);
  if (slot.fileId && fileIds.has(slot.fileId)) {
    return { match: true, reason: `file_id ${slot.fileId}` };
  }

  const basenames = acceptableBasenames(img);
  if (slot.basename && basenames.has(slot.basename)) {
    return { match: true, reason: `basename ${slot.basename}` };
  }

  if (img.localPath && fs.existsSync(img.localPath)) {
    const localHash = createHash('sha256').update(fs.readFileSync(img.localPath)).digest('hex');
    if (localHash === img.sha256 && slot.src) {
      const slotHash = await sha256FromUrl(slot.src);
      if (slotHash && slotHash === localHash) {
        return { match: true, reason: 'sha256 matches local upload file' };
      }
    }
  }

  if (slot.src) {
    const slotHash = await sha256FromUrl(slot.src);
    if (slotHash && slotHash === img.sha256) {
      return { match: true, reason: 'sha256 matches manifest bytes' };
    }

    const sourceHash = await sha256FromUrl(img.sourceUrl);
    if (slotHash && sourceHash && slotHash === sourceHash) {
      return { match: true, reason: 'sha256 matches source URL bytes' };
    }

    if (img.resolvedUrl) {
      const resolvedHash = await sha256FromUrl(img.resolvedUrl);
      if (slotHash && resolvedHash && slotHash === resolvedHash) {
        return { match: true, reason: 'sha256 matches resolved URL bytes' };
      }
    }
  }

  return { match: false };
}

export async function verifyProductImagesOnPage(
  page: Page,
  manifest: ImageManifest
): Promise<void> {
  await page.waitForTimeout(2000);
  const actualSlots = await collectMainImageSlots(page);
  const expected = manifest.images.map((img) => ({
    sort: img.sort,
    sourceBasename: imageBasename(normalizeSourceImageUrl(img.sourceUrl)),
    resolvedBasename: img.resolvedUrl
      ? imageBasename(normalizeSourceImageUrl(img.resolvedUrl))
      : '',
    sourceFileId: img.sourceFileId,
    resolvedFileId: img.resolvedFileId,
    sha256: img.sha256,
    sourceUrl: img.sourceUrl,
    resolvedUrl: img.resolvedUrl,
  }));

  const matchResults: Array<{ sort: number; matched: boolean; reason?: string }> = [];
  const mismatches: string[] = [];

  if (actualSlots.length < manifest.images.length) {
    const debugPath = path.join(DEBUG_DIR, `images-verify-${manifest.sourceId}.json`);
    const report = {
      sourceId: manifest.sourceId,
      expected,
      actualSlots,
      matchResults,
      error: 'insufficient_slots',
    };
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(debugPath, JSON.stringify(report, null, 2));
    await saveDebug(page, `images-verify-${manifest.sourceId}`);
    throw new Error(
      `Image verify failed: expected ${manifest.images.length} Product images slots, found ${actualSlots.length} (see ${debugPath})`
    );
  }

  for (let i = 0; i < manifest.images.length; i++) {
    const result = await slotMatchesManifest(actualSlots[i], manifest.images[i]);
    matchResults.push({
      sort: manifest.images[i].sort,
      matched: result.match,
      reason: result.reason,
    });
    if (!result.match) {
      const img = manifest.images[i];
      const slot = actualSlots[i];
      mismatches.push(
        `slot ${i + 1}: file_id=${slot.fileId ?? 'none'}, basename=${slot.basename ?? 'none'} — expected file_id in [${[...acceptableFileIds(img)].join('|')}] or basename in [${[...acceptableBasenames(img)].join('|')}] or matching sha256`
      );
    }
  }

  const debugPath = path.join(DEBUG_DIR, `images-verify-${manifest.sourceId}.json`);
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  fs.writeFileSync(
    debugPath,
    JSON.stringify({ sourceId: manifest.sourceId, expected, actualSlots, matchResults }, null, 2)
  );

  if (mismatches.length) {
    await saveDebug(page, `images-verify-${manifest.sourceId}`);
    throw new Error(`Image verify failed: ${mismatches.join('; ')} (see ${debugPath})`);
  }

  console.log(`    Image verify OK: ${manifest.images.length} image(s) match manifest`);
}

export async function uploadProductImagesFromManifest(
  page: Page,
  manifest: ImageManifest
): Promise<void> {
  await page.waitForTimeout(2000);
  const directOk = await uploadViaDirectSlots(page, manifest);
  if (!directOk) {
    console.log('    Direct upload failed — trying strict photobank picker');
    await uploadViaPhotobank(page, manifest);
  }

  await verifyProductImagesOnPage(page, manifest);
}
