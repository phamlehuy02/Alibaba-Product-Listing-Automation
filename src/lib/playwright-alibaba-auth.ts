import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const PROFILE_DIR = path.join(process.cwd(), '.playwright-profile');
const STORAGE_STATE_PATH = path.join(PROFILE_DIR, 'storage-state.json');
const PRODUCT_LIST_URL = 'https://i.alibaba.com/products/list-manage#/product/all';
const LOGIN_URL = 'https://login.alibaba.com/';

const attachedBrowsers = new WeakMap<BrowserContext, Browser>();

export type PlaywrightSessionOptions = {
  headless?: boolean;
  userDataDir?: string;
  /** Always use on-disk Chromium profile (for the one-time manual login script). */
  forcePersistent?: boolean;
};

function storageStatePath(userDataDir: string): string {
  return path.join(userDataDir, 'storage-state.json');
}

function isLoginPageUrl(url: string): boolean {
  return /login\.alibaba\.com/i.test(url);
}

function isSellerCenterHost(url: string): boolean {
  return /i\.alibaba\.com/i.test(url) && !isLoginPageUrl(url);
}

function isProductListPageUrl(url: string): boolean {
  return /i\.alibaba\.com\/products\/list-manage/i.test(url) && !isLoginPageUrl(url);
}

/** User finished login when they leave login.alibaba.com (often lands on www.alibaba.com first). */
function hasLeftLoginPage(url: string): boolean {
  if (isLoginPageUrl(url)) return false;
  if (/chrome-error:/i.test(url)) return false;
  if (url === 'about:blank') return false;
  return /alibaba\.com/i.test(url);
}

export async function launchAlibabaContext(
  options?: PlaywrightSessionOptions
): Promise<BrowserContext> {
  const headless = options?.headless ?? process.env.PLAYWRIGHT_HEADLESS === 'true';
  const userDataDir = options?.userDataDir ?? PROFILE_DIR;
  const launchArgs = ['--disable-blink-features=AutomationControlled'];
  const contextOptions = {
    viewport: { width: 1440, height: 900 } as const,
    locale: 'en-US',
  };

  const savedState = storageStatePath(userDataDir);
  if (!options?.forcePersistent && fs.existsSync(savedState)) {
    const browser = await chromium.launch({ headless, args: launchArgs });
    const context = await browser.newContext({
      ...contextOptions,
      storageState: savedState,
    });
    attachedBrowsers.set(context, browser);
    return context;
  }

  return chromium.launchPersistentContext(userDataDir, {
    headless,
    ...contextOptions,
    args: launchArgs,
  });
}

export async function closeAlibabaContext(context: BrowserContext): Promise<void> {
  const browser = attachedBrowsers.get(context);
  await context.close();
  if (browser) {
    attachedBrowsers.delete(context);
    await browser.close();
  }
}

async function closeExtraPages(context: BrowserContext, keep: Page): Promise<void> {
  for (const p of context.pages()) {
    if (p !== keep) await p.close().catch(() => undefined);
  }
}

async function waitForPageToSettle(page: Page, ms = 3000): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
}

async function sellerCenterUiReady(page: Page): Promise<boolean> {
  if (isProductListPageUrl(page.url())) {
    const body = await page.locator('body').innerText({ timeout: 8000 }).catch(() => '');
    if (/product\s*id|product\s*name|duplicate\s*product|all\s*products/i.test(body)) {
      return true;
    }
  }

  const roots = [page, ...page.frames()];
  for (const root of roots) {
    const productId = root.getByPlaceholder(/product\s*id/i);
    if (await productId.isVisible({ timeout: 3000 }).catch(() => false)) return true;

    const searchBtn = root.getByRole('button', { name: /^search$/i });
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) return true;
  }

  return page
    .locator('table, [class*="product"], [class*="list"]')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
}

async function isOnProductListPage(page: Page): Promise<boolean> {
  if (!isProductListPageUrl(page.url())) return false;
  await waitForPageToSettle(page, 4000);
  if (isLoginPageUrl(page.url())) return false;
  if (await sellerCenterUiReady(page)) return true;
  // SPA loaded at the right URL — accept even if selectors differ (iframe/locale).
  return isProductListPageUrl(page.url());
}

async function navigateToProductListSafely(page: Page): Promise<void> {
  if (await isOnProductListPage(page)) return;

  try {
    await page.goto(PRODUCT_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    const msg = String(err);
    if (!/interrupted|chromewebdata/i.test(msg)) throw err;
    await waitForPageToSettle(page, 4000);
  }

  await waitForPageToSettle(page, 2000);
}

/** Wait until product list is open and stable enough to save cookies. */
export async function finalizeLoginSession(page: Page): Promise<void> {
  if (isLoginPageUrl(page.url())) {
    throw new Error('Redirected back to login — sign in again: npm run playwright-login');
  }

  if (!(await isOnProductListPage(page))) {
    await navigateToProductListSafely(page);
  }

  if (isLoginPageUrl(page.url())) {
    throw new Error('Redirected back to login — sign in again: npm run playwright-login');
  }

  if (!(await isOnProductListPage(page))) {
    throw new Error('Product list did not load — finish signing in and run: npm run playwright-login');
  }

  console.log('Product list ready — saving session...');
  await waitForPageToSettle(page, 2000);
}

export async function saveSessionState(
  context: BrowserContext,
  userDataDir: string = PROFILE_DIR
): Promise<string> {
  const target = storageStatePath(userDataDir);
  await fs.promises.mkdir(userDataDir, { recursive: true });

  const page =
    context.pages().find((p) => isProductListPageUrl(p.url())) ??
    context.pages().find((p) => isSellerCenterHost(p.url())) ??
    context.pages()[0] ??
    null;

  if (page) {
    await closeExtraPages(context, page);
    await waitForPageToSettle(page, 2000);
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await context.storageState({ path: target });
      return target;
    } catch (err) {
      const retryable = /destroyed|navigation|context/i.test(String(err));
      if (!retryable || attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 2000));
      if (page) await waitForPageToSettle(page, 1500);
    }
  }

  return target;
}

/** Navigate to Seller Center and confirm the product list is open. */
export async function isSellerCenterLoggedIn(page: Page): Promise<boolean> {
  try {
    await navigateToProductListSafely(page);
    if (isLoginPageUrl(page.url())) return false;
    return await isOnProductListPage(page);
  } catch {
    return false;
  }
}

/** Open i.alibaba.com product list after login (from www.alibaba.com or elsewhere). */
export async function settleSellerCenterSession(page: Page): Promise<boolean> {
  if (isLoginPageUrl(page.url())) return false;
  if (await isOnProductListPage(page)) return true;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await navigateToProductListSafely(page);
    } catch {
      await waitForPageToSettle(page, 3000);
    }
    if (isLoginPageUrl(page.url())) return false;
    if (await isOnProductListPage(page)) return true;
    await page.waitForTimeout(2000);
  }

  return false;
}

/**
 * First-time setup only: open login page and wait for the user to sign in manually.
 * Login is detected when the tab leaves login.alibaba.com (e.g. www.alibaba.com).
 */
export async function waitForManualSellerLogin(
  context: BrowserContext,
  options?: { manualMs?: number }
): Promise<Page> {
  const manualMs = options?.manualMs ?? 300_000;
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Sign in manually in the browser (complete captcha/slider if shown).');
  console.log('After login you may land on alibaba.com — the script will open Seller Center automatically.');

  const deadline = Date.now() + manualMs;
  let openedSellerCenter = false;

  while (Date.now() < deadline) {
    const url = page.url();

    if (await isOnProductListPage(page)) {
      console.log('Seller Center product list is open.');
      return page;
    }

    if (isLoginPageUrl(url)) {
      try {
        await page.waitForURL(
          (u) => hasLeftLoginPage(u.href),
          { timeout: Math.min(15_000, deadline - Date.now()), waitUntil: 'domcontentloaded' }
        );
      } catch {
        // Still on login page.
      }
      await page.waitForTimeout(2000);
      continue;
    }

    if (/chrome-error:/i.test(url)) {
      await page.waitForTimeout(3000);
      continue;
    }

    if (hasLeftLoginPage(url)) {
      if (!openedSellerCenter) {
        console.log(`Login detected (${url}). Opening Seller Center product list...`);
        openedSellerCenter = true;
      }
      if (await settleSellerCenterSession(page)) return page;
    }

    await page.waitForTimeout(2000);
  }

  throw new Error('Manual login timed out — finish signing in and run: npm run playwright-login');
}

/**
 * Re-open saved session in a fresh browser and confirm Seller Center loads.
 */
export async function verifyPersistedSession(
  options?: Pick<PlaywrightSessionOptions, 'userDataDir' | 'headless'>
): Promise<boolean> {
  const userDataDir = options?.userDataDir ?? PROFILE_DIR;
  if (!fs.existsSync(storageStatePath(userDataDir))) {
    return false;
  }

  const context = await launchAlibabaContext({
    headless: options?.headless ?? false,
    userDataDir,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return await isSellerCenterLoggedIn(page);
  } finally {
    await closeAlibabaContext(context);
  }
}

/** Reuse saved session from a prior manual login. Does not open a login form. */
export async function ensureSellerCenterSession(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage());

  if (await isSellerCenterLoggedIn(page)) {
    console.log('Seller Center session active (reusing saved profile).');
    return page;
  }

  throw new Error(
    'Seller Center is not logged in. Run once: npm run playwright-login (manual sign-in, session saved to .playwright-profile/)'
  );
}

export { PRODUCT_LIST_URL, PROFILE_DIR, STORAGE_STATE_PATH };
