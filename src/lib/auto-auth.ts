import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { AlibabaAPI } from './alibaba-api';
import qrcodeTerminal from 'qrcode-terminal';
import jsQR from 'jsqr';
import { Jimp } from 'jimp';
import fs from 'fs';
import { exec } from 'child_process';

puppeteer.use(StealthPlugin());

export async function performAutoAuth(appKey: string, appSecret: string): Promise<any> {
  const redirectUri = 'https://example.com/callback';
  const oauthUrl = `https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log('🤖 Launching browser for auto-authentication...');
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();

  try {
    let authCode: string | null = null;
    
    // Intercept requests to grab the redirect code
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith(redirectUri)) {
        const urlObj = new URL(url);
        authCode = urlObj.searchParams.get('code');
        console.log('✅ Authorization code intercepted!');
        request.abort();
      } else {
        request.continue();
      }
    });

    // Also watch for navigation to the callback URL
    page.on('response', async (response) => {
      const url = response.url();
      if (url.startsWith(redirectUri)) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        if (code) authCode = code;
      }
    });

    console.log('🤖 Navigating to Alibaba OAuth page...');
    await page.goto(oauthUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // ── STEP 1: Check if we are already logged in ──────────────────────────
    console.log('🤖 Checking if already logged in...');
    const alreadyLoggedIn = await page.$('#sub').catch(() => null);
    
    if (alreadyLoggedIn) {
      console.log('✅ Already logged in! Clicking Authorize button directly...');
      await alreadyLoggedIn.click();
      // Wait for redirect
      await new Promise(r => setTimeout(r, 5000));
      
      if (authCode) {
        console.log('🎉 Auth code captured after direct authorize!');
        const api = new AlibabaAPI({ appKey, appSecret });
        return await api.exchangeCodeForToken(authCode, redirectUri);
      }
      
      // Check current URL in case it redirected
      const currentUrl = page.url();
      if (currentUrl.startsWith(redirectUri)) {
        const urlObj = new URL(currentUrl);
        authCode = urlObj.searchParams.get('code');
        if (authCode) {
          const api = new AlibabaAPI({ appKey, appSecret });
          return await api.exchangeCodeForToken(authCode, redirectUri);
        }
      }
    }

    // ── STEP 2: Try clicking the initial Sign In button in the oauth iframe ──
    const frames = page.frames();
    let initialClicked = false;
    for (const frame of frames) {
      const btn = await frame.$('#fm-login-submit').catch(() => null);
      if (btn) {
        console.log('🤖 Found initial Sign In button, clicking...');
        await btn.click();
        initialClicked = true;
        break;
      }
    }

    if (initialClicked) {
      console.log('🤖 Waiting for login form to load...');
      await new Promise(r => setTimeout(r, 5000));
    }

    // Check again for #sub after Sign In button click
    const postClickAuthorize = await page.$('#sub').catch(() => null);
    if (postClickAuthorize) {
      console.log('✅ Authorize button appeared! Clicking...');
      await postClickAuthorize.click();
      await new Promise(r => setTimeout(r, 5000));
      if (authCode) {
        const api = new AlibabaAPI({ appKey, appSecret });
        return await api.exchangeCodeForToken(authCode, redirectUri);
      }
    }

    // ── STEP 3: Fall back to QR code login ────────────────────────────────
    console.log('🤖 Switching to QR Code Login...');
    
    const qrToggleSelectors = [
      '[class*="QRCodeButton--qrCode--"]',
      '.icon-qrcode', 
      '.login-qrcode', 
      'i[class*="qrcode"]', 
      '.J_Quick2Static'
    ];
    let qrToggled = false;
    const newFrames = page.frames();
    for (const frame of newFrames) {
      for (const sel of qrToggleSelectors) {
        const toggle = await frame.$(sel).catch(() => null);
        if (toggle) {
          console.log(`🤖 Found QR toggle with selector ${sel}, clicking...`);
          await frame.click(sel);
          qrToggled = true;
          break;
        }
      }
      if (qrToggled) break;
    }
    
    await new Promise(r => setTimeout(r, 3000));

    // Extract canvas QR code
    console.log('🤖 Extracting QR code image...');
    let screenshotBuffer: Buffer | undefined;
    for (const frame of newFrames) {
      const canvas = await frame.$('canvas').catch(() => null);
      if (canvas) {
        console.log('🤖 Found QR canvas, extracting data...');
        const dataUrl = await frame.$eval('canvas', (el: any) => el.toDataURL());
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        screenshotBuffer = Buffer.from(base64Data, 'base64');
        break;
      }
    }

    if (!screenshotBuffer) {
      const buf = await page.screenshot({ type: 'png' });
      screenshotBuffer = Buffer.from(buf);
    }
    
    const qrPath = `${process.cwd()}/qrcode.png`;
    fs.writeFileSync(qrPath, screenshotBuffer);
    console.log(`\n✅ QR code saved to: ${qrPath}`);
    
    exec(`open "${qrPath}"`, (err) => {
      if (!err) console.log('📂 QR code image opened automatically — scan it with your Alibaba.com app!');
    });

    try {
      const image = await Jimp.read(Buffer.from(screenshotBuffer));
      const qrCode = jsQR(
        new Uint8ClampedArray(image.bitmap.data), 
        image.bitmap.width, 
        image.bitmap.height
      );
      if (qrCode) {
        console.log('\n\n📱 PLEASE SCAN THIS QR CODE WITH YOUR ALIBABA APP:');
        qrcodeTerminal.generate(qrCode.data, { small: true });
      } else {
        console.log('⚠️ Please open "qrcode.png" and scan it with your Alibaba app.');
      }
    } catch {
      console.log('⚠️ Please open "qrcode.png" and scan it with your Alibaba app.');
    }

    console.log('🤖 Waiting for authorization... (Timeout in 3 minutes)');
    
    let retries = 0;
    while (!authCode && retries < 180) {
      await new Promise(r => setTimeout(r, 1000));
      
      // After scan, check for the Authorize button and click it
      try {
        const authorizeBtn = await page.$('#sub').catch(() => null) 
                          || await page.$('.auth-submit-btn').catch(() => null);
        if (authorizeBtn) {
          console.log('🤖 Found Authorize button, clicking...');
          await authorizeBtn.click().catch(() => {});
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (e) {
        // Ignore context errors during navigation
      }
      
      // Check current URL
      try {
        const currentUrl = page.url();
        if (currentUrl.startsWith(redirectUri)) {
          const urlObj = new URL(currentUrl);
          authCode = urlObj.searchParams.get('code');
          break;
        }
      } catch (e) {}
      
      if (retries === 20) {
        await page.screenshot({ path: 'debug-after-scan.png' }).catch(() => {});
        try {
          const html = await page.content();
          fs.writeFileSync('debug-after-scan.html', html);
          console.log('📸 Debug screenshot saved (debug-after-scan.png)');
        } catch (e) {}
      }
      
      retries++;
    }

    if (fs.existsSync('qrcode.png')) fs.unlinkSync('qrcode.png');

    if (!authCode) {
      throw new Error('Timeout waiting for authorization. Please try again.');
    }

    console.log('🤖 Authorization code captured! Exchanging for tokens...');
    const api = new AlibabaAPI({ appKey, appSecret });
    return await api.exchangeCodeForToken(authCode, redirectUri);

  } finally {
    await browser.close();
  }
}
