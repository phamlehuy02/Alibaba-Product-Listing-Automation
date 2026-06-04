import cron from 'node-cron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { CampaignManager } from './campaign-manager';
import { optimizeProduct } from './ai-optimizer';
import { AlibabaAPI } from './alibaba-api';
import {
  VARIETY_IDS,
  PROCESSING_TYPE_IDS,
  CULTIVATION_TYPE_IDS,
  ORIGIN_IDS,
  COMPANY_CERTS,
} from './schema-maps';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'token.json');

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  obtained_at?: string;
}

export class AutomationEngine {
  private static isRunning = false;

  // ── Token management ──────────────────────────────────────────────────────

  private static loadTokens(): StoredTokens | null {
    try {
      if (existsSync(TOKENS_FILE)) {
        return JSON.parse(readFileSync(TOKENS_FILE, 'utf-8'));
      }
    } catch {}
    return null;
  }

  private static saveTokens(tokens: StoredTokens) {
    writeFileSync(TOKENS_FILE, JSON.stringify({
      ...tokens,
      obtained_at: new Date().toISOString(),
    }, null, 2), 'utf-8');
  }

  private static isTokenExpired(tokens: StoredTokens): boolean {
    if (!tokens.obtained_at || !tokens.expires_in) return false;
    const obtainedMs = new Date(tokens.obtained_at).getTime();
    const expiresMs = obtainedMs + (tokens.expires_in * 1000);
    const bufferMs = 10 * 60 * 1000;
    return Date.now() > (expiresMs - bufferMs);
  }

  private static async getApiClient(): Promise<AlibabaAPI | null> {
    const appKey = process.env.ALIBABA_APP_KEY || '';
    const appSecret = process.env.ALIBABA_APP_SECRET || '';

    if (!appKey || !appSecret) return null;

    let tokens = this.loadTokens();
    if (!tokens || !tokens.access_token) {
      console.log('⚠️ No tokens found. Attempting auto-authentication...');
      try {
        const { performAutoAuth } = await import('./auto-auth');
        const tokenData = await performAutoAuth(appKey, appSecret);
        if (tokenData && tokenData.access_token) {
          tokens = { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in };
          this.saveTokens(tokens);
          console.log('✅ Auto-authentication successful.');
        } else return null;
      } catch (err) {
        console.error('❌ Auto-authentication failed:', err);
        return null;
      }
    }

    const api = new AlibabaAPI({ appKey, appSecret, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

    if (this.isTokenExpired(tokens)) {
      console.log('🔄 Access token expired — refreshing...');
      try {
        const refreshed = await api.refreshToken();
        tokens = { ...tokens, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || tokens.refresh_token, expires_in: refreshed.expires_in };
        this.saveTokens(tokens);
        console.log('✅ Token refreshed successfully.');
      } catch {
        console.error('❌ Token refresh failed. Attempting auto-authentication...');
        try {
          const { performAutoAuth } = await import('./auto-auth');
          const tokenData = await performAutoAuth(appKey, appSecret);
          if (tokenData && tokenData.access_token) {
            tokens = { ...tokens, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in };
            this.saveTokens(tokens);
            console.log('✅ Auto-authentication successful.');
          } else return null;
        } catch (err) {
          console.error('❌ Auto-authentication failed after token expiry:', err);
          return null;
        }
      }
    }

    return api;
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  static init() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!process.env.ALIBABA_APP_KEY || !process.env.ALIBABA_APP_SECRET) {
      console.log('⚠️  Automation Engine: Alibaba credentials not configured. Cron scheduler paused.');
      return;
    }

    const tokens = this.loadTokens();
    if (!tokens?.access_token) {
      console.log('⚠️  Automation Engine: No access token found. Complete OAuth on the Settings page.');
    } else {
      console.log('🚀 Alibaba Automation Engine Started (tokens loaded)');
    }

    cron.schedule('0 9 * * *', () => { this.processCampaigns(); });
  }

  static async processCampaigns() {
    console.log('Starting daily listing batch...');
    const campaigns = CampaignManager.getCampaigns().filter(c => c.active);

    if (campaigns.length === 0) { console.log('  No active campaigns.'); return; }

    const TARGET_POSTS = 5;
    let successfulPosts = 0;

    for (let i = 0; i < TARGET_POSTS; i++) {
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      console.log(`[Post ${i + 1}/${TARGET_POSTS}] Processing variation for: ${campaign.name}`);
      if (await this.executeListing(campaign)) successfulPosts++;
      if (i < TARGET_POSTS - 1) await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`🎉 Daily batch complete! Successfully posted ${successfulPosts} products.`);
  }

  // ── XML Injection Helpers ─────────────────────────────────────────────────

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  /**
   * Inject a <value> node into a simple (non-nested) field.
   * Preserves existing <rules>/<options>/<fields> children.
   * Works for: input, singleCheck, and any field without nested <field> children.
   */
  private static injectXmlField(
    xml: string,
    fieldId: string,
    value: string,
    extraAttrs: string = ''
  ): string {
    const isCdata = value.startsWith('<![CDATA[') && value.endsWith(']]>');
    const escapedValue = isCdata ? value : this.escapeXml(value);

    const pattern = new RegExp(
      `(<field id="${fieldId}"[^>]*>)([\\s\\S]*?)(<\\/field>)`,
      'g'
    );
    return xml.replace(
      pattern,
      (_match: string, open: string, inner: string, close: string) => {
        const withoutValue = inner.replace(/<value[^>]*>[\s\S]*?<\/value>/g, '');
        return `${open}${withoutValue}<value${extraAttrs ? ' ' + extraAttrs : ''}>${escapedValue}</value>${close}`;
      }
    );
  }

  /**
   * Inject a <values> block into a multiCheck field.
   * Used for p-19122 (Processing Type) and productCertificate.
   *
   * The multiCheck XML format differs from singleCheck:
   *   <values>
   *     <value [attr="..."]>OPTION_ID</value>
   *   </values>
   *
   * For productCertificate, each value also carries number/type/body attributes.
   */
  private static injectMultiCheckValues(
    xml: string,
    fieldId: string,
    values: Array<{ content: string; attrs?: Record<string, string> }>
  ): string {
    const valuesXml = values.map(v => {
      const isCdata = v.content.startsWith('<![CDATA[') && v.content.endsWith(']]>');
      const escapedContent = isCdata ? v.content : this.escapeXml(v.content);

      if (!v.attrs || Object.keys(v.attrs).length === 0) {
        return `<value>${escapedContent}</value>`;
      }
      const attrStr = Object.entries(v.attrs)
        .map(([k, val]) => `${k}="${this.escapeXml(val)}"`)
        .join(' ');
      return `<value ${attrStr}>${escapedContent}</value>`;
    }).join('');

    // Use simple regex — multiCheck fields have <rules>/<options> but NO nested <field> tags
    const pattern = new RegExp(
      `(<field id="${fieldId}"[^>]*>)([\\s\\S]*?)(<\\/field>)`
    );
    return xml.replace(pattern, (_match, open, inner, close) => {
      const withoutValues = inner.replace(/<values>[\s\S]*?<\/values>/g, '');
      return `${open}${withoutValues}<values>${valuesXml}</values>${close}`;
    });
  }

  /**
   * Inject values into sub-fields of a complex parent field.
   * Used for ladderPrice_N (quantity + price) and customMoreProperty_N (propName + valueName).
   *
   * The current injectXmlField regex stops at the first </field> it encounters,
   * which would be an inner sub-field's close tag for complex fields. This helper
   * uses depth-counting to correctly bound the parent block first.
   */
  private static injectComplexSubField(
    xml: string,
    parentFieldId: string,
    subValues: Record<string, string>
  ): string {
    // Find the parent field's opening tag
    const openTagRegex = new RegExp(`<field id="${parentFieldId}"[^>]*>`);
    const openMatch = openTagRegex.exec(xml);
    if (!openMatch) return xml;

    const blockStart = openMatch.index;
    let pos = blockStart + openMatch[0].length;
    let depth = 1;

    // Walk forward counting <field (depth++) and </field> (depth--)
    // Stop when depth hits 0 — that's the parent's closing tag.
    // Note: <fields> and </fields> are different tags and must NOT be counted.
    while (pos < xml.length && depth > 0) {
      const nextOpen  = xml.indexOf('<field', pos);
      const nextClose = xml.indexOf('</field>', pos);

      if (nextClose === -1) break; // Malformed XML guard

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Verify it's <field[SPACE|>] and not <fields>
        const charAfter = xml[nextOpen + 6]; // char immediately after '<field'
        if (charAfter === ' ' || charAfter === '>') {
          depth++;
        }
        pos = nextOpen + 1;
      } else {
        depth--;
        if (depth === 0) {
          const blockEnd = nextClose + '</field>'.length;
          // We now have the complete parent block
          let block = xml.substring(blockStart, blockEnd);

          // Inject each sub-value into the bounded block
          for (const [subId, value] of Object.entries(subValues)) {
            block = AutomationEngine.injectXmlField(block, subId, value);
          }

          return xml.substring(0, blockStart) + block + xml.substring(blockEnd);
        }
        pos = nextClose + 1;
      }
    }

    return xml; // No match or malformed — return unchanged
  }

  // ── Structured Attribute Injection ────────────────────────────────────────

  /**
   * Inject all structured product attribute fields into the schema XML.
   * Called after title, description, and image injections in executeListing().
   *
   * Priority order: Critical → High (matches the implementation plan).
   */
  private static injectStructuredAttributes(xml: string, campaign: any): string {
    const t = campaign.template || {};
    let injected = 0;

    const log = (fieldId: string, value: string) => {
      console.log(`  ✓ [${fieldId}] = "${String(value).substring(0, 60)}"`);
      injected++;
    };

    // ── 🔴 CRITICAL ──────────────────────────────────────────────────────────

    // Shelf Life — required by schema rules
    if (t.shelfLife) {
      xml = this.injectXmlField(xml, 'p-191286392', t.shelfLife);
      log('p-191286392 (Shelf Life)', t.shelfLife);
    }

    // MOQ — strip non-numeric characters (e.g. "1 kilogram" → "1")
    const rawMoq = String(t.moq || '1');
    const moqNum = rawMoq.replace(/[^\d.]/g, '') || '1';
    xml = this.injectXmlField(xml, 'minOrderQuantity', moqNum);
    log('minOrderQuantity (MOQ)', moqNum);

    // Variety — map display name to option ID
    if (t.beanVariety && VARIETY_IDS[t.beanVariety]) {
      xml = this.injectXmlField(xml, 'p-19127', VARIETY_IDS[t.beanVariety]);
      log('p-19127 (Variety)', `${t.beanVariety} → ${VARIETY_IDS[t.beanVariety]}`);
    }

    // Place of Origin — fuzzy-match origin string to option ID
    if (t.origin) {
      const originKey = Object.keys(ORIGIN_IDS).find(k =>
        t.origin.toLowerCase().includes(k.toLowerCase())
      );
      if (originKey) {
        xml = this.injectXmlField(xml, 'p-1', ORIGIN_IDS[originKey]);
        log('p-1 (Origin)', `${originKey} → ${ORIGIN_IDS[originKey]}`);
      } else {
        console.log(`  ⚠️ [p-1 (Origin)] No ID found for "${t.origin}" — skipping`);
      }
    }

    // ── 🟠 HIGH ───────────────────────────────────────────────────────────────

    // Processing Type (multiCheck)
    const procId = t.productType === 'green-beans'
      ? PROCESSING_TYPE_IDS.Green
      : (PROCESSING_TYPE_IDS[t.processing] ?? PROCESSING_TYPE_IDS['Roasted']);
    if (procId) {
      xml = this.injectMultiCheckValues(xml, 'p-19122', [{ content: procId }]);
      log('p-19122 (Processing Type)', `${t.productType || 'roasted'} → ${procId}`);
    }

    // Cultivation Type — derive from certifications array
    const isOrganic = Array.isArray(t.certifications) &&
      t.certifications.some((c: string) => c.toLowerCase().includes('organic'));
    const cultivationId = isOrganic ? CULTIVATION_TYPE_IDS.Organic : CULTIVATION_TYPE_IDS.COMMON;
    xml = this.injectXmlField(xml, 'p-19112', cultivationId);
    log('p-19112 (Cultivation Type)', isOrganic ? 'Organic' : 'COMMON');

    // Packaging
    if (t.packagingType) {
      xml = this.injectXmlField(xml, 'p-191286084', t.packagingType);
      log('p-191286084 (Packaging)', t.packagingType);
    }

    // Max Moisture % — strip non-numeric chars (e.g. "< 12.5%" → "12.5")
    if (t.moisture) {
      const moistureNum = String(t.moisture).replace(/[^\d.]/g, '');
      if (moistureNum) {
        xml = this.injectXmlField(xml, 'p-19136', moistureNum);
        log('p-19136 (Moisture %)', moistureNum);
      }
    }

    // Brand Name
    const brandName = t.brandName || process.env.ALIBABA_BRAND_NAME || 'Detech Coffee';
    xml = this.injectXmlField(xml, 'p-2', brandName);
    log('p-2 (Brand Name)', brandName);

    // Product Certificates — inject all registered company certs
    xml = this.injectMultiCheckValues(
      xml,
      'productCertificate',
      COMPANY_CERTS.map(c => ({
        content: c.id,
        attrs: { number: c.number, type: c.type, body: c.body },
      }))
    );
    log('productCertificate', COMPANY_CERTS.map(c => c.name).join(', '));

    // Tiered Pricing — switch to mode "1" (tiered) and fill ladderPrice_0..N
    if (Array.isArray(t.priceTiers) && t.priceTiers.length > 0) {
      xml = this.injectXmlField(xml, 'scPrice', '1');
      t.priceTiers.slice(0, 4).forEach((tier: { minQty: number; price: number }, idx: number) => {
        xml = this.injectComplexSubField(xml, `ladderPrice_${idx}`, {
          quantity: String(Math.round(tier.minQty)),
          price:    tier.price.toFixed(2),
        });
        log(`ladderPrice_${idx}`, `qty≥${tier.minQty} → $${tier.price}`);
      });
    }

    // Custom Attributes (propName / valueName key-value pairs)
    if (Array.isArray(t.customAttributes) && t.customAttributes.length > 0) {
      t.customAttributes.slice(0, 30).forEach(
        (attr: { propName: string; valueName: string }, idx: number) => {
          xml = this.injectComplexSubField(xml, `customMoreProperty_${idx}`, {
            propName:  attr.propName,
            valueName: attr.valueName,
          });
          log(`customMoreProperty_${idx}`, `${attr.propName}: ${attr.valueName}`);
        }
      );
    }

    console.log(`📋 Structured attributes: ${injected} fields injected.`);
    return xml;
  }

  // ── Media Helpers ─────────────────────────────────────────────────────────

  /**
   * Attempt to resolve campaign image URLs to Photobank fileIds via URL matching.
   * Returns matched { url, fileId }[] pairs. Unmatched URLs are dropped.
   */
  private static async resolvePhotoFileIds(
    api: AlibabaAPI,
    campaignImageUrls: string[]
  ): Promise<{ url: string; fileId: string }[]> {
    if (!campaignImageUrls?.length) return [];

    const getHash = (url: string) => {
      const parts = url.split('/');
      const filename = parts[parts.length - 1].split('?')[0];
      return filename.split('.')[0].split('_')[0].toLowerCase();
    };

    const targetHashes = new Set(campaignImageUrls.map(getHash));
    const matched: { url: string; fileId: string }[] = [];

    try {
      const groupsResult = await api.listPhotobankGroups();
      const groups =
        groupsResult.alibaba_icbu_photobank_group_list_response?.result?.groups ||
        groupsResult.result?.groups || [];

      const allGroups = [
        ...groups.map((g: any) => String(g.id)),
        '-1', '0', ''
      ];

      for (const groupId of allGroups) {
        if (matched.length >= campaignImageUrls.length) break;
        const imgResult = await api.listPhotobankImages(groupId, 1, 100);
        const photoList =
          imgResult.alibaba_icbu_photobank_list_response?.photo_list?.photo ||
          imgResult.result?.photo_list?.photo ||
          imgResult.result?.pagination_query_list?.list || [];

        for (const photo of photoList) {
          if (!photo.url) continue;
          const photoHash = getHash(photo.url);
          if (targetHashes.has(photoHash)) {
            if (!matched.some(m => m.fileId === String(photo.id))) {
              matched.push({ url: photo.url, fileId: String(photo.id) });
              if (matched.length >= campaignImageUrls.length) break;
            }
          }
        }
      }
    } catch (e) {
      console.error('⚠️ Error during photobank URL matching:', e);
    }

    console.log(`📷 Hash match: ${matched.length}/${campaignImageUrls.length} campaign images resolved from Photobank.`);
    return matched;
  }

  /**
   * Fetch dynamic media (images + video).
   * Priority: campaign-stored images → Photobank keyword group → any group.
   *           campaign.video_id → Video API query.
   */
  private static async fetchDynamicMedia(
    api: AlibabaAPI,
    keyword: string,
    campaignImages?: string[],
    campaignVideoId?: string
  ) {
    let images: { url: string; fileId: string }[] = [];
    let videoId: string | undefined = campaignVideoId;

    // 1. Try to match stored campaign image URLs
    if (campaignImages?.length) {
      console.log(`🔍 Attempting URL-based match for ${campaignImages.length} stored campaign images...`);
      images = await this.resolvePhotoFileIds(api, campaignImages);
    } else {
      console.log(`⏭️  No campaign images provided. Will retain base product images.`);
    }

    if (videoId) {
      console.log(`🎬 Using stored campaign video_id: ${videoId}`);
    } else {
      console.log(`⏭️  No campaign video provided. Will retain base product video.`);
    }

    return { images, videoId };
  }

  // ── Core Listing Flow ─────────────────────────────────────────────────────

  private static async executeListing(campaign: any): Promise<boolean> {
    try {
      // 1. Generate AI-optimized content variation
      const optimized = await optimizeProduct(campaign.template, true);

      // 2. Get authenticated API client
      const api = await this.getApiClient();
      if (!api) {
        console.log(`⏭️  Skipping ${campaign.name} — no valid API client.`);
        return false;
      }

      // 3. Resolve media (images + video)
      let mediaKeyword = 'coffee';
      const pType = campaign.template.productType;
      if (pType === 'green-beans') {
        mediaKeyword = 'green coffee';
      } else if (pType === 'drip-bag') {
        mediaKeyword = 'drip bag';
      } else if (pType === 'ground-coffee') {
        mediaKeyword = 'ground coffee';
      } else {
        mediaKeyword = 'roasted coffee';
      }
      const dynamicMedia = await this.fetchDynamicMedia(
        api, mediaKeyword, campaign.images, campaign.video_id
      );

      let finalImages = dynamicMedia.images;

      if (!finalImages.length && !campaign.template.title && !campaign.template.description) {
        console.log(`📋 Note: No template overrides provided. Relying purely on base product cloning.`);
      }

      // 4. Fetch base product schema to clone
      let baseProductId = campaign.template.baseProductId;
      let baseProductCatId = campaign.template.category || 100009031;

      if (!baseProductId) {
        const listRes = await api.listProducts(1, 50); // Get up to 50 products to find matching category
        const products =
          listRes.alibaba_icbu_product_list_response?.products?.product ||
          (Array.isArray(listRes.result?.products) ? listRes.result.products : listRes.result?.products?.product) ||
          (Array.isArray(listRes.result) ? listRes.result : []);
        if (products.length) {
          // Try to find a product in the same category
          const matchingProduct = products.find((p: any) => String(p.category_id || p.categoryId) === String(baseProductCatId));
          if (matchingProduct) {
            baseProductId = String(matchingProduct.product_id || matchingProduct.id);
            console.log(`🔍 Found existing product ${baseProductId} with matching Category ${baseProductCatId} to clone.`);
          } else {
            // Fallback to first product
            baseProductId = String(products[0].product_id || products[0].id);
            baseProductCatId = products[0].category_id || baseProductCatId;
            console.warn(`⚠️ No existing product found in Category ${campaign.template.category}. Cloning Product ${baseProductId} in Category ${baseProductCatId} instead.`);
          }
        }
      }

      if (!baseProductId) {
        console.error(`❌ Skipping ${campaign.name} — no base product found.`);
        return false;
      }

      console.log(`🔁 Cloning base schema ID: ${baseProductId} (Category: ${baseProductCatId})`);
      let baseXml = '';
      let pDetails: any = {};
      try {
        baseXml = await api.getProductSchema(baseProductId, String(baseProductCatId));
        if (!baseXml) throw new Error('Empty schema returned');
      } catch (e) {
        console.error(`❌ Failed to get base schema for ${baseProductId}`, e);
        return false;
      }

      // Fetch actual product details to retrieve missing fields like images, keywords, and prices
      try {
        const detailRes = await (api as any).execute('/icbu/product/get', {
          product_get_request: JSON.stringify({ productId: Number(baseProductId) })
        });
        pDetails = detailRes.product || detailRes.result?.product || detailRes.result || {};
        console.log(`✅ Retrieved base product details from API.`);
      } catch (e: any) {
        console.warn(`⚠️ Failed to retrieve base product details: ${e.message}. Using default fallbacks.`);
      }

      // ── 5. Inject content into schema XML ────────────────────────────────

      // 5a. Product title
      const newTitle = optimized.title || campaign.template.title;
      if (newTitle) {
        baseXml = this.injectXmlField(baseXml, 'productTitle', `<![CDATA[${newTitle}]]>`);
        console.log(`📝 Title (${newTitle.length} chars): "${newTitle.substring(0, 80)}..."`);
      }

      // 5b. Rich HTML description
      const newDescription = optimized.description || campaign.template.description;
      if (newDescription) {
        baseXml = this.injectXmlField(baseXml, 'superText', `<![CDATA[${newDescription}]]>`);
        console.log(`📄 Description injected (${newDescription.length} chars)`);
      }

      // 5c. Product images (scImages_0..5 sub-fields)
      if (!finalImages.length) {
        const baseImages = pDetails.mainImage?.images || [];
        if (baseImages.length > 0) {
          console.log(`🔍 Resolving ${baseImages.length} base product images from Photobank...`);
          finalImages = await this.resolvePhotoFileIds(api, baseImages);
        }
      }

      if (!finalImages.length) {
        // Fallback: Query photobank group matching the product type
        console.log(`⚠️ No matched base product images found in Photobank. Falling back to fetching images from matching Photobank group...`);
        try {
          const groupsResult = await api.listPhotobankGroups();
          const groups = groupsResult.result?.groups || [];
          
          let targetGroupName = 'Roasted Coffee ';
          if (pType === 'green-beans') {
            targetGroupName = 'Green bean coffee';
          } else if (pType === 'drip-bag') {
            targetGroupName = 'Coffee filter bag';
          } else if (pType === 'ground-coffee') {
            targetGroupName = 'Roasted Coffee ';
          }
          
          const matchedGroup = groups.find((g: any) => g.name.toLowerCase().trim() === targetGroupName.toLowerCase().trim());
          if (matchedGroup) {
            console.log(`🔍 Found matching Photobank group "${matchedGroup.name}" (${matchedGroup.id}). Fetching images...`);
            const imgRes = await api.listPhotobankImages(String(matchedGroup.id), 1, 10);
            const list = imgRes.result?.pagination_query_list?.list || imgRes.result?.photo_list?.photo || [];
            finalImages = list.slice(0, 6).map((img: any) => ({
              url: img.url,
              fileId: String(img.id)
            }));
            console.log(`✅ Fetched ${finalImages.length} images from group "${matchedGroup.name}".`);
          } else {
            console.warn(`⚠️ Could not find photobank group matching "${targetGroupName}".`);
          }
        } catch (err: any) {
          console.error(`❌ Failed to fetch photobank fallback images:`, err.message);
        }
      }

      if (finalImages.length) {
        let imgIdx = 0;
        baseXml = baseXml.replace(
          /(<field id="scImages_\d+"[^>]*>)([\s\S]*?)(<\/field>)/g,
          (match, open, inner, close) => {
            if (imgIdx >= finalImages.length) return match;
            const img = finalImages[imgIdx++];
            const withoutValue = inner.replace(/<value[^>]*>[\s\S]*?<\/value>/g, '');
            const escapedUrl = this.escapeXml(img.url);
            const escapedFileId = this.escapeXml(img.fileId);
            return `${open}${withoutValue}<value fileId="${escapedFileId}">${escapedUrl}</value>${close}`;
          }
        );
        console.log(`🖼️  ${imgIdx} images injected into scImages sub-fields.`);
      }

      // 5d. All structured product attributes (Critical → High priority)
      console.log('📋 Injecting structured attributes:');
      baseXml = this.injectStructuredAttributes(baseXml, campaign);

      // 5e. Inject required core fields that are omitted by getProductSchema()
      console.log('📋 Injecting core trade & media fields:');
      
      // 5e-1. Price Unit
      const unitStr = String(pDetails.wholesaleTrade?.unitType || 'Kilogram').toLowerCase();
      let priceUnitVal = '16'; // Default: Kilogram/Kilograms
      if (unitStr.includes('bag')) priceUnitVal = '1';
      else if (unitStr.includes('ton')) priceUnitVal = '11';
      else if (unitStr.includes('piece')) priceUnitVal = '4';
      else if (unitStr.includes('box')) priceUnitVal = '28';
      else if (unitStr.includes('carton')) priceUnitVal = '29';
      else if (unitStr.includes('pack')) priceUnitVal = '21';
      else if (unitStr.includes('liter')) priceUnitVal = '22';
      else if (unitStr.includes('gram')) priceUnitVal = '17';
      
      baseXml = this.injectXmlField(baseXml, 'priceUnit', priceUnitVal);
      console.log(`  ✓ [priceUnit] = "${priceUnitVal}" (mapped from "${unitStr}")`);

      // 5e-2. Product Keywords
      let keywordsList: string[] = [];
      let defaultKeywords = ['Coffee Beans', 'Specialty Coffee', 'Vietnam Coffee'];
      if (pType === 'green-beans') {
        defaultKeywords = ['Green Coffee Beans', 'Raw Coffee Beans', 'Arabica Green Coffee'];
      } else if (pType === 'drip-bag') {
        defaultKeywords = ['Drip Bag Coffee', 'Hanging Ear Coffee', 'Single Serve Coffee Bag'];
      } else if (pType === 'ground-coffee') {
        defaultKeywords = ['Ground Coffee Powder', 'Espresso Ground Coffee', 'Vietnamese Ground Coffee'];
      } else if (pType === 'roasted-beans' || pType === 'roasted-coffee') {
        defaultKeywords = ['Roasted Coffee Beans', 'Arabica Coffee Beans', 'Vietnamese Roasted Coffee'];
      }
      
      if (Array.isArray(pDetails.keywords) && pDetails.keywords.length > 0) {
        const rawKey = pDetails.keywords[0] || '';
        const parsedKeys = rawKey.split(/[,\n;]/).map((k: string) => k.trim()).filter(Boolean);
        if (parsedKeys.length >= 3) {
          keywordsList = parsedKeys.slice(0, 3);
        } else {
          const words = rawKey.split(/\s+/).filter(Boolean);
          if (words.length >= 6) {
            keywordsList = [
              words.slice(0, 3).join(' '),
              words.slice(3, 6).join(' '),
              words.slice(6, 9).join(' ')
            ];
          }
        }
      }
      if (keywordsList.length < 3) {
        keywordsList = defaultKeywords;
      }
      for (let idx = 0; idx < 3; idx++) {
        const kw = keywordsList[idx] || defaultKeywords[idx] || 'Coffee Beans';
        baseXml = this.injectXmlField(baseXml, `productKeywords_${idx}`, kw);
        console.log(`  ✓ [productKeywords_${idx}] = "${kw}"`);
      }

      // 5e-3. Ladder Period (Shipping/lead times)
      const periods = pDetails.wholesaleTrade?.deliverPeriods || [];
      if (Array.isArray(periods) && periods.length > 0) {
        periods.slice(0, 3).forEach((period: any, idx: number) => {
          baseXml = this.injectComplexSubField(baseXml, `ladderPeriod_${idx}`, {
            quantity: String(period.quantity || '10000'),
            day: String(period.processPeriod || period.day || '15'),
          });
          console.log(`  ✓ [ladderPeriod_${idx}] = qty:${period.quantity || '10000'}, days:${period.processPeriod || '15'}`);
        });
      } else {
        baseXml = this.injectComplexSubField(baseXml, 'ladderPeriod_0', {
          quantity: '10000',
          day: '15',
        });
        console.log(`  ✓ [ladderPeriod_0] = qty:10000, days:15 (default fallback)`);
      }

      // Save the payload for debugging
      writeFileSync(path.join(process.cwd(), 'scratch', 'post-payload.xml'), baseXml, 'utf-8');

      // ── 6. POST to Alibaba ────────────────────────────────────────────────
      const result = await api.addProductSchema(Number(baseProductCatId), baseXml);

      if (result?.result?.success === false) {
        const errCode = result.result.msg_code || 'UNKNOWN';
        const errMsg = (result.result.message_info || '').substring(0, 200);
        console.error(`❌ Listing FAILED for ${campaign.name}. API error [${errCode}]: ${errMsg}`);
        return false;
      }

      const productId =
        result?.result?.data ||
        result?.result?.product_id ||
        result?.data ||
        result?.alibaba_icbu_product_schema_add_response?.product_id;
      console.log(`✅ Listing successful for ${campaign.name}. Product ID: ${productId}`);

      campaign.lastRun = new Date().toISOString();
      CampaignManager.saveCampaign(campaign);
      return true;

    } catch (error) {
      console.error(`❌ Automation failed for ${campaign.name}:`, error);
      return false;
    }
  }
}
