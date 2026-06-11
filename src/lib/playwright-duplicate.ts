import fs from 'fs';
import path from 'path';
import type { Frame, Locator, Page } from 'playwright';
import type { AlibabaAPI } from './alibaba-api';
import { PRODUCT_LIST_URL } from './playwright-alibaba-auth';
import { prepareSourceImageManifest } from './playwright-image-prep';
import { uploadProductImagesFromManifest } from './playwright-image-upload';
import type { PhotobankIndex } from './listing-v2-normalizer';
import { rearrangeTitleMinimalUnique } from './title-rearranger';

const DEBUG_DIR = path.join(process.cwd(), 'scratch', 'playwright-debug');

export type PlaywrightDuplicateResult = {
  sourceId: string;
  cloneId: string;
  seedTitle: string;
  sourceTitle: string;
  success: boolean;
  error?: string;
};

async function saveDebug(page: Page, label: string): Promise<void> {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9_-]+/gi, '_');
  await page.screenshot({ path: path.join(DEBUG_DIR, `${safe}.png`), fullPage: true }).catch(() => {});
}

async function findProductIdInput(page: Page) {
  const byPlaceholder = page.getByPlaceholder(/product id/i);
  if (await byPlaceholder.isVisible({ timeout: 3000 }).catch(() => false)) {
    return byPlaceholder.first();
  }

  const labels = page.locator('label, span, div').filter({ hasText: /^product id$/i });
  if ((await labels.count()) > 0) {
    const container = labels.first().locator('xpath=ancestor::*[.//input][1]');
    const input = container.locator('input').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) return input;
  }

  const inputs = page.locator('input[type="text"], input:not([type])');
  const count = await inputs.count();
  if (count >= 2) return inputs.nth(1);
  return inputs.first();
}

function productIdPattern(productId: string): RegExp {
  return new RegExp(`ID:\\s*${productId}\\b|\\b${productId}\\b`, 'i');
}

function productIdLabelPattern(productId: string): RegExp {
  return new RegExp(`ID:\\s*${productId}\\b`, 'i');
}

function searchRoots(page: Page): Array<Page | Frame> {
  return [page, ...page.frames()];
}

/** Count listing rows — use <tr> only, never nested div[class*="row"] (double-count bug). */
async function countListingRows(page: Page, productId: string): Promise<number> {
  const idRe = productIdPattern(productId);

  for (const root of searchRoots(page)) {
    const trRows = root.locator('tr').filter({
      hasText: idRe,
      has: root.getByText(/duplicate product/i),
    });
    const trCount = await trRows.count();
    if (trCount > 0) return trCount;

    const ariaRows = root.getByRole('row').filter({
      hasText: idRe,
      has: root.getByText(/duplicate product/i),
    });
    const ariaCount = await ariaRows.count();
    if (ariaCount > 0) return ariaCount;
  }

  return (await findDuplicateLink(page, productId)) ? 1 : 0;
}

async function findDuplicateLink(page: Page, productId: string): Promise<Locator | null> {
  const idRe = productIdPattern(productId);
  const idLabelRe = productIdLabelPattern(productId);

  for (const root of searchRoots(page)) {
    const trRow = root.locator('tr').filter({
      hasText: idRe,
      has: root.getByText(/duplicate product/i),
    });
    if (await trRow.count()) {
      return trRow.first().getByText(/duplicate product/i).first();
    }

    const ariaRow = root.getByRole('row').filter({
      hasText: idRe,
      has: root.getByText(/duplicate product/i),
    });
    if (await ariaRow.count()) {
      return ariaRow.first().getByText(/duplicate product/i).first();
    }

    const idLabel = root.getByText(idLabelRe).first();
    if (await idLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      for (const xpath of ['xpath=ancestor::tr[1]', 'xpath=ancestor::*[@role="row"][1]']) {
        const container = idLabel.locator(xpath);
        if ((await container.count()) > 0) {
          const dup = container.getByText(/duplicate product/i).first();
          if (await dup.isVisible({ timeout: 2000 }).catch(() => false)) {
            return dup;
          }
        }
      }
    }

    const dupLinks = root.getByText(/duplicate product/i);
    const linkCount = await dupLinks.count();
    for (let i = 0; i < linkCount; i++) {
      const link = dupLinks.nth(i);
      for (const xpath of ['xpath=ancestor::tr[1]', 'xpath=ancestor::*[@role="row"][1]']) {
        const container = link.locator(xpath).filter({ hasText: idRe });
        if ((await container.count()) > 0) {
          return link;
        }
      }
    }
  }

  return null;
}

async function waitForSearchResult(page: Page, productId: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if ((await countListingRows(page, productId)) > 0) return;
    for (const root of searchRoots(page)) {
      const idLabel = root.getByText(productIdLabelPattern(productId)).first();
      if (await idLabel.isVisible({ timeout: 500 }).catch(() => false)) return;
    }
    await page.waitForTimeout(1000);
  }
}

export async function searchProductById(page: Page, productId: string): Promise<void> {
  await page.goto(PRODUCT_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  const idInput = await findProductIdInput(page);
  await idInput.click();
  await idInput.fill('');
  await idInput.fill(productId);

  const searchBtn = page.getByRole('button', { name: /^search$/i }).first();
  await searchBtn.click();

  await waitForSearchResult(page, productId);
  await page.waitForTimeout(1500);
}

async function readTitleFromInput(input: Locator): Promise<string> {
  const fromInput = (await input.inputValue().catch(() => '')).trim();
  if (fromInput) return fromInput;
  const fromAttr = (await input.getAttribute('value'))?.trim() ?? '';
  if (fromAttr) return fromAttr;
  return input.evaluate((el) => (el as HTMLInputElement).value).catch(() => '');
}

async function findProductTitleOnPage(page: Page): Promise<Locator | null> {
  for (const root of searchRoots(page)) {
    const visible = root
      .locator('input#productTitle:not(#productTitle-animation), input[name="productTitle"]:not(#productTitle-animation)')
      .first();
    if ((await visible.count()) > 0 && (await visible.isVisible({ timeout: 2000 }).catch(() => false))) {
      return visible;
    }
  }

  for (const root of searchRoots(page)) {
    for (const sel of ['input#productTitle-animation', 'input#productTitle', 'input[name="productTitle"]']) {
      const el = root.locator(sel).first();
      if ((await el.count()) === 0) continue;
      if ((await readTitleFromInput(el)).trim()) return el;
    }
  }

  return null;
}

/** Close duplicate-editor tabs so retries start from a clean list page. */
export async function closeDuplicateEditorTabs(listPage: Page): Promise<void> {
  const context = listPage.context();
  for (const p of context.pages()) {
    if (p === listPage || p.isClosed()) continue;
    const url = p.url();
    const looksLikeEditor =
      /post|publish|create|edit|product|liteProduct/i.test(url) ||
      (await findProductTitleOnPage(p)) !== null;
    if (looksLikeEditor) {
      await p.close().catch(() => undefined);
    }
  }
  await listPage.bringToFront().catch(() => undefined);
}

function normalizeTitleForVerify(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

/** Wait for Alibaba duplicate editor — often a new tab, not the list page. */
async function waitForProductTitleField(page: Page, timeoutMs = 60_000): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const p of page.context().pages()) {
      const found = await findProductTitleOnPage(p);
      if (found) return found;
    }
    await page.waitForTimeout(1000);
  }

  await saveDebug(page, 'product-title-not-found');
  throw new Error('Timed out waiting for #productTitle on duplicate listing page');
}

/**
 * Click Duplicate product and return the page that has the listing editor
 * (new tab or same-tab navigation).
 */
export async function clickDuplicateOnSearchResult(page: Page, productId: string): Promise<Page> {
  const rowCount = await countListingRows(page, productId);
  const dupLink = await findDuplicateLink(page, productId);

  if (!dupLink || rowCount !== 1) {
    await saveDebug(page, `search-rows-${productId}`);
    throw new Error(`Expected exactly 1 listing row for ${productId}, found ${rowCount}`);
  }

  const context = page.context();
  const newTabPromise = context.waitForEvent('page', { timeout: 25_000 }).catch(() => null);

  await dupLink.scrollIntoViewIfNeeded();
  await dupLink.click();

  const newTab = await newTabPromise;
  const editorPage = newTab ?? page;

  if (newTab) {
    await newTab.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
  } else {
    await page
      .waitForURL(/post|publish|create|edit|product/i, { timeout: 30_000 })
      .catch(() => undefined);
  }

  await waitForProductTitleField(editorPage);
  return editorPage;
}

async function setInputValue(input: Locator, value: string): Promise<void> {
  if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
    await input.scrollIntoViewIfNeeded().catch(() => undefined);
    await input.click();
    await input.press('ControlOrMeta+a');
    await input.fill(value);
    await input.dispatchEvent('input');
    await input.dispatchEvent('change');
    await input.blur();
  }

  await input.evaluate((el, v) => {
    const node = el as HTMLInputElement;
    node.value = v;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** Alibaba keeps the prefilled title on hidden #productTitle-animation — update all name=productTitle inputs. */
async function writeProductTitle(page: Page, value: string): Promise<void> {
  await waitForProductTitleField(page);
  let wrote = false;

  for (const root of searchRoots(page)) {
    const titleRoot = root.locator('#struct-productTitle, [id*="productTitle"], [class*="productTitle"]').first();
    const scope = (await titleRoot.count()) > 0 ? titleRoot : root;

    const visible = scope
      .locator('input#productTitle:not(#productTitle-animation), input[name="productTitle"]:not(#productTitle-animation)')
      .first();
    if ((await visible.count()) > 0) {
      await visible.scrollIntoViewIfNeeded().catch(() => undefined);
      await visible.click();
      await visible.press('ControlOrMeta+a');
      await visible.fill(value);
      await visible.dispatchEvent('input');
      await visible.dispatchEvent('change');
      await visible.blur();
      wrote = true;
    }

    const inputs = scope.locator(
      'input[name="productTitle"], input#productTitle, input#productTitle-animation'
    );
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await setInputValue(inputs.nth(i), value);
      wrote = true;
    }
  }

  if (!wrote) throw new Error('Could not write product title');
}

export type ProductTitleObservation = {
  visible: string;
  animation: string;
  all: string[];
};

export async function readProductTitleFromPage(page: Page): Promise<ProductTitleObservation> {
  let visible = '';
  let animation = '';
  const all: string[] = [];

  for (const root of searchRoots(page)) {
    const visibleInput = root
      .locator('input#productTitle:not(#productTitle-animation), input[name="productTitle"]:not(#productTitle-animation)')
      .first();
    if ((await visibleInput.count()) > 0) {
      visible = (await readTitleFromInput(visibleInput)).trim();
    }

    const animationInput = root.locator('input#productTitle-animation').first();
    if ((await animationInput.count()) > 0) {
      animation = (await readTitleFromInput(animationInput)).trim();
    }

    const inputs = root.locator('input[name="productTitle"], input#productTitle, input#productTitle-animation');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const value = (await readTitleFromInput(inputs.nth(i))).trim();
      if (value) all.push(value);
    }
  }

  return { visible, animation, all: [...new Set(all)] };
}

export async function verifyProductTitleOnPage(
  page: Page,
  expectedTitle: string,
  sourceId: string
): Promise<void> {
  await page.waitForTimeout(1000);
  const observed = await readProductTitleFromPage(page);

  const debugPath = path.join(DEBUG_DIR, `title-verify-${sourceId}.json`);
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  fs.writeFileSync(
    debugPath,
    JSON.stringify({ sourceId, expectedTitle, observed }, null, 2)
  );

  const expectedNorm = normalizeTitleForVerify(expectedTitle);
  const matches = (actual: string) => normalizeTitleForVerify(actual) === expectedNorm;
  const ok =
    matches(observed.visible) ||
    matches(observed.animation) ||
    observed.all.some(matches);

  if (!ok) {
    await saveDebug(page, `title-verify-${sourceId}`);
    throw new Error(
      `Title verify failed: expected "${expectedTitle}", visible="${observed.visible}", animation="${observed.animation}", all=[${observed.all.join(' | ')}] (see ${debugPath})`
    );
  }

  const display =
    observed.visible && matches(observed.visible)
      ? observed.visible
      : observed.animation && matches(observed.animation)
        ? observed.animation
        : observed.all.find(matches) ?? expectedTitle;
  console.log(`    Title verify OK: "${display}"`);
}

function isUniqueRearrangeFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Could not find unique rearranged title');
}

async function revealAiTitleGenerateButton(page: Page): Promise<void> {
  const nameInput = (await findProductTitleOnPage(page)) ?? (await waitForProductTitleField(page));
  await nameInput.scrollIntoViewIfNeeded();
  await nameInput.click({ force: true });
  await page.waitForTimeout(600);

  for (const root of searchRoots(page)) {
    const titleRoot = root.locator('#struct-productTitle').first();
    if ((await titleRoot.count()) > 0) {
      await titleRoot.click({ position: { x: 20, y: 20 }, force: true }).catch(() => undefined);
    }
  }
  await page.waitForTimeout(400);
}

async function findAiGenerateButton(page: Page): Promise<Locator | null> {
  for (const root of searchRoots(page)) {
    const titleRoot = root.locator('#struct-productTitle').first();
    if ((await titleRoot.count()) > 0) {
      const inTitle = titleRoot.locator('button.ai-suggestion-generate').first();
      if (
        (await inTitle.count()) > 0 &&
        (await inTitle.isVisible({ timeout: 300 }).catch(() => false))
      ) {
        return inTitle;
      }
    }
    const btn = root
      .locator('button.ai-suggestion-generate')
      .filter({ hasText: /generate/i })
      .first();
    if (
      (await btn.count()) > 0 &&
      (await btn.isVisible({ timeout: 300 }).catch(() => false))
    ) {
      return btn;
    }
  }
  return null;
}

async function waitForAiGenerateButton(page: Page, timeoutMs = 8000): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const btn = await findAiGenerateButton(page);
    if (btn) return btn;
    await revealAiTitleGenerateButton(page);
    await page.waitForTimeout(500);
  }
  return null;
}

async function findAiTitleApplyButton(page: Page): Promise<Locator | null> {
  const applySelector =
    'button.ggs-next-prefix-btn, button.ggs-next-prefix-wrapper-button';
  for (const root of searchRoots(page)) {
    const titleRoot = root.locator('#struct-productTitle').first();
    if ((await titleRoot.count()) > 0) {
      const inTitle = titleRoot
        .locator(applySelector)
        .filter({ hasText: /^apply$/i })
        .first();
      if (
        (await inTitle.count()) > 0 &&
        (await inTitle.isVisible({ timeout: 500 }).catch(() => false))
      ) {
        return inTitle;
      }
    }
    const btn = root.locator(applySelector).filter({ hasText: /^apply$/i }).first();
    if (
      (await btn.count()) > 0 &&
      (await btn.isVisible({ timeout: 500 }).catch(() => false))
    ) {
      return btn;
    }
  }
  return null;
}

/** Click Alibaba "Generate" → wait for AI → "Apply" on the duplicate listing title field. */
export async function applyAlibabaAiGeneratedTitle(
  page: Page,
  sourceId: string
): Promise<string> {
  await revealAiTitleGenerateButton(page);
  const generateBtn = await waitForAiGenerateButton(page);
  if (!generateBtn) {
    await saveDebug(page, `ai-generate-missing-${sourceId}`);
    throw new Error('Alibaba AI Generate button (ai-suggestion-generate) not found');
  }

  const titleBefore = (await readProductTitleFromPage(page)).visible;

  await generateBtn.scrollIntoViewIfNeeded();
  await generateBtn.click();

  const regenerating = page.getByText(/regenerating/i).first();
  await regenerating.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);

  const deadline = Date.now() + 90_000;
  let applyBtn: Locator | null = null;
  while (Date.now() < deadline) {
    const stillRegenerating = await regenerating.isVisible({ timeout: 300 }).catch(() => false);
    if (!stillRegenerating) {
      applyBtn = await findAiTitleApplyButton(page);
      if (applyBtn) break;
    }
    await page.waitForTimeout(500);
  }

  if (!applyBtn) {
    await saveDebug(page, `ai-apply-timeout-${sourceId}`);
    throw new Error('Timed out waiting for Alibaba AI title Apply button');
  }

  await applyBtn.scrollIntoViewIfNeeded();
  await applyBtn.click();
  await page.waitForTimeout(1500);

  const observed = await readProductTitleFromPage(page);
  const seedTitle = (observed.visible || observed.animation || observed.all[0] || '').trim();
  if (!seedTitle) {
    await saveDebug(page, `ai-title-empty-${sourceId}`);
    throw new Error('AI title Apply completed but product name field is empty');
  }

  console.log(`  Title via AI Generate: "${titleBefore}" → "${seedTitle}"`);
  return seedTitle;
}

export async function setRearrangedProductName(
  page: Page,
  sourceId: string,
  usedTitles: Set<string>,
  options?: { verify?: boolean }
): Promise<{ sourceTitle: string; seedTitle: string }> {
  const nameInput = (await findProductTitleOnPage(page)) ?? (await waitForProductTitleField(page));
  await nameInput.waitFor({ state: 'attached', timeout: 15000 });
  const sourceTitle = (await readTitleFromInput(nameInput)).trim();
  if (!sourceTitle) {
    throw new Error('Product name field is empty after duplicate');
  }

  let seedTitle: string;
  try {
    ({ title: seedTitle } = rearrangeTitleMinimalUnique(sourceTitle, sourceId, usedTitles));
    await writeProductTitle(page, seedTitle);
    console.log(`  Title rearranged: "${sourceTitle}" → "${seedTitle}"`);
  } catch (err) {
    if (!isUniqueRearrangeFailure(err)) throw err;
    console.log('  No unique rearranged title — using Alibaba AI Generate');
    seedTitle = await applyAlibabaAiGeneratedTitle(page, sourceId);
    usedTitles.add(seedTitle);
  }

  if (options?.verify !== false) {
    await verifyProductTitleOnPage(page, seedTitle, sourceId);
  }

  return { sourceTitle, seedTitle };
}

export async function submitListing(page: Page): Promise<string | undefined> {
  const submit = page
    .getByRole('button', { name: /^submit$/i })
    .or(page.getByText(/^submit$/i))
    .first();

  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await page.waitForTimeout(4000);

  const bodyText = (await page.locator('body').innerText()).toLowerCase();
  const success =
    /success|submitted|published|created successfully|listing has been/i.test(bodyText);

  if (!success) {
    await saveDebug(page, 'submit-unclear');
    const err = page.locator('[class*="error"], [class*="fail"]').first();
    const errText = (await err.innerText().catch(() => '')).trim();
    if (errText) throw new Error(`Submit failed: ${errText}`);
    console.warn('Submit success message not detected — checking URL for product id');
  }

  const url = page.url();
  const idMatch =
    url.match(/[?&](?:itemId|productId|product_id)=(\d{10,})/i) ||
    url.match(/(\d{13,})/);
  if (idMatch) return idMatch[1];

  const idInPage = await page
    .locator('text=/\\d{13,}/')
    .first()
    .innerText()
    .catch(() => '');
  const pageMatch = idInPage.match(/\d{13,}/);
  return pageMatch?.[0];
}

export async function duplicateProductViaPlaywright(
  page: Page,
  sourceId: string,
  api: AlibabaAPI,
  usedTitles: Set<string>,
  options?: { photobank?: PhotobankIndex }
): Promise<PlaywrightDuplicateResult> {
  let editorPage: Page | null = null;
  try {
    const stopAfterTitle = process.env.PLAYWRIGHT_STOP_AFTER_TITLE === 'true';
    let manifest: Awaited<ReturnType<typeof prepareSourceImageManifest>> | null = null;
    if (!stopAfterTitle) {
      console.log('  Preparing images via API...');
      manifest = await prepareSourceImageManifest(api, sourceId, {
        photobank: options?.photobank,
      });
    }

    await closeDuplicateEditorTabs(page);
    await searchProductById(page, sourceId);
    editorPage = await clickDuplicateOnSearchResult(page, sourceId);

    const { sourceTitle, seedTitle } = await setRearrangedProductName(
      editorPage,
      sourceId,
      usedTitles
    );

    if (stopAfterTitle) {
      console.log('  Stopping after title (PLAYWRIGHT_STOP_AFTER_TITLE=true) — verify in browser.');
      return {
        sourceId,
        cloneId: 'title-only',
        sourceTitle,
        seedTitle,
        success: true,
      };
    }

    if (!manifest) {
      console.log('  Preparing images via API...');
      manifest = await prepareSourceImageManifest(api, sourceId, {
        photobank: options?.photobank,
      });
    }
    await uploadProductImagesFromManifest(editorPage, manifest);

    if (process.env.PLAYWRIGHT_STOP_AFTER_IMAGES === 'true') {
      console.log('  Stopping after images (PLAYWRIGHT_STOP_AFTER_IMAGES=true) — verify in browser.');
      return {
        sourceId,
        cloneId: 'images-only',
        sourceTitle,
        seedTitle,
        success: true,
      };
    }

    const cloneId = (await submitListing(editorPage)) ?? 'unknown';

    if (!editorPage.isClosed()) {
      await editorPage.close().catch(() => undefined);
    }
    await page.bringToFront().catch(() => undefined);

    return {
      sourceId,
      cloneId,
      sourceTitle,
      seedTitle,
      success: cloneId !== 'unknown',
      error: cloneId === 'unknown' ? 'Submitted but could not read new product id' : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (editorPage && !editorPage.isClosed()) {
      await saveDebug(editorPage, `error-${sourceId}`);
    } else {
      await saveDebug(page, `error-${sourceId}`);
    }
    await closeDuplicateEditorTabs(page);
    return {
      sourceId,
      cloneId: 'unknown',
      sourceTitle: '',
      seedTitle: '',
      success: false,
      error: message,
    };
  }
}
