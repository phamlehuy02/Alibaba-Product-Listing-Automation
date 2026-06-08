import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { CampaignManager } from './campaign-manager';
import { optimizeProduct } from './ai-optimizer';
import { AlibabaAPI } from './alibaba-api';
import { getAuthorizedApiClient } from './api-client';
import {
  VARIETY_IDS,
  PROCESSING_TYPE_IDS,
  CULTIVATION_TYPE_IDS,
  ORIGIN_IDS,
  COMPANY_CERTS,
} from './schema-maps';
import { sortByLastUpdated } from './alibaba-product-utils';

export const LISTING_BATCH_SIZE = 5;
export const LISTING_POOL_SIZE = 500;

export type ListingAttemptFailure = {
  campaignName: string;
  reason: string;
};

export type ListingBatchResult = {
  success: boolean;
  attempted: number;
  successful: number;
  error?: string;
  failures?: ListingAttemptFailure[];
};

type ListingAttemptResult = { ok: true } | { ok: false; reason: string };

const SCRATCH_DIR = path.join(process.cwd(), 'scratch');

export class AutomationEngine {
  private static getApiClient(): Promise<AlibabaAPI | null> {
    return getAuthorizedApiClient();
  }

  /** Post up to LISTING_BATCH_SIZE new listings from random active campaigns in the latest LISTING_POOL_SIZE. */
  static async runListingBatch(): Promise<ListingBatchResult> {
    if (!process.env.ALIBABA_APP_KEY || !process.env.ALIBABA_APP_SECRET) {
      return {
        success: false,
        attempted: 0,
        successful: 0,
        error: 'Alibaba API credentials are not configured.',
      };
    }

    const api = await this.getApiClient();
    if (!api) {
      return {
        success: false,
        attempted: 0,
        successful: 0,
        error: 'Not connected to Alibaba. Complete OAuth on the Settings page.',
      };
    }

    const activeCampaigns = CampaignManager.getCampaigns().filter((c) => c.active);
    if (activeCampaigns.length === 0) {
      return {
        success: false,
        attempted: 0,
        successful: 0,
        error: 'No active products. Load products from Alibaba or create a campaign first.',
      };
    }

    const pool = sortByLastUpdated(activeCampaigns).slice(0, LISTING_POOL_SIZE);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const toPost = shuffled.slice(0, Math.min(LISTING_BATCH_SIZE, shuffled.length));

    console.log(
      `Starting listing batch (${toPost.length} posts from latest ${pool.length} products)…`
    );
    let successfulPosts = 0;
    const failures: ListingAttemptFailure[] = [];

    for (let i = 0; i < toPost.length; i++) {
      const campaign = toPost[i];
      console.log(`[Post ${i + 1}/${toPost.length}] Processing: ${campaign.name}`);
      const attempt = await this.executeListing(campaign);
      if (attempt.ok) {
        successfulPosts++;
      } else {
        failures.push({ campaignName: campaign.name, reason: attempt.reason });
      }
      if (i < toPost.length - 1) await new Promise((r) => setTimeout(r, 5000));
    }

    console.log(`Listing batch complete. Posted ${successfulPosts}/${toPost.length}.`);
    const summaryError =
      successfulPosts === 0 && failures.length > 0
        ? failures
            .slice(0, 3)
            .map((f) => `${f.campaignName}: ${f.reason}`)
            .join(' · ')
        : successfulPosts === 0
          ? 'No listings were posted.'
          : undefined;

    return {
      success: successfulPosts > 0,
      attempted: toPost.length,
      successful: successfulPosts,
      failures: failures.length > 0 ? failures : undefined,
      error: summaryError,
    };
  }

  private static sanitizeKeyword(keyword: string): string {
    return keyword
      .replace(/[;:,,<>]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  /** Tiered price + price mode — required for schema publish when ladderPrice is empty. */
  private static injectWholesalePricing(xml: string, campaign: any, pDetails: any): string {
    const template = campaign.template || {};
    const trade = pDetails?.wholesaleTrade || {};

    xml = this.injectXmlField(xml, 'scPrice', '1');
    xml = this.injectXmlField(xml, 'marketPrice', '1');

    const moqForMarket = String(template.moq ?? '100').replace(/[^\d.]/g, '') || '100';
    xml = this.injectXmlField(xml, 'marketMinOrderQuantity', moqForMarket);

    const tiers: Array<{ quantity: string; price: string }> = [];
    const ranges = trade.priceRanges || trade.ladderPrices || trade.price_range_list;
    if (Array.isArray(ranges) && ranges.length > 0) {
      for (const r of ranges.slice(0, 4)) {
        const qty = r.minQuantity ?? r.quantity ?? r.min_qty ?? r.startQuantity;
        const price = r.price ?? r.unitPrice ?? r.unit_price;
        if (qty != null && price != null) {
          tiers.push({
            quantity: String(Math.round(Number(qty))),
            price: Number(price).toFixed(2),
          });
        }
      }
    }

    if (tiers.length === 0) {
      const sku = pDetails?.sku_info?.sku_list?.[0] || pDetails?.skuList?.[0];
      const moqRaw = String(
        template.moq ?? sku?.moq ?? trade.minOrderQuantity ?? trade.min_order_quantity ?? '100'
      );
      const moq = moqRaw.replace(/[^\d.]/g, '') || '100';
      const priceRaw = template.price ?? sku?.price ?? trade.price ?? trade.minPrice ?? '10';
      const price = Number(String(priceRaw).replace(/[^\d.]/g, '') || '10').toFixed(2);
      tiers.push({ quantity: moq, price });
      const moqNum = Number(moq) || 100;
      const priceNum = Number(price) || 10;
      tiers.push({
        quantity: String(moqNum * 10),
        price: (priceNum * 0.95).toFixed(2),
      });
      tiers.push({
        quantity: String(moqNum * 50),
        price: (priceNum * 0.9).toFixed(2),
      });
      tiers.push({
        quantity: String(moqNum * 100),
        price: (priceNum * 0.85).toFixed(2),
      });
    }

    tiers.slice(0, 4).forEach((tier, idx) => {
      xml = this.injectComplexSubField(xml, `ladderPrice_${idx}`, tier);
      console.log(`  ✓ [ladderPrice_${idx}] = qty≥${tier.quantity}, $${tier.price}`);
    });

    return xml;
  }

  private static writeDebugPayload(filename: string, contents: string) {
    try {
      mkdirSync(SCRATCH_DIR, { recursive: true });
      writeFileSync(path.join(SCRATCH_DIR, filename), contents, 'utf-8');
    } catch (e) {
      console.warn(`Could not write debug payload ${filename}:`, e);
    }
  }

  private static removeFieldById(xml: string, fieldId: string): string {
    const openRegex = new RegExp(`<field\\s+id="${fieldId}"(\\s[^>]*>|>)`);
    const openMatch = openRegex.exec(xml);
    if (!openMatch) return xml;

    const blockStart = openMatch.index;
    let pos = blockStart + openMatch[0].length;
    let depth = 1;

    while (pos < xml.length && depth > 0) {
      const nextOpen = xml.indexOf('<field', pos);
      const nextClose = xml.indexOf('</field>', pos);
      if (nextClose === -1) break;

      const charAfter = nextOpen !== -1 ? xml[nextOpen + 6] : '';
      const isFieldOpen =
        nextOpen !== -1 && nextOpen < nextClose && (charAfter === ' ' || charAfter === '>');

      if (isFieldOpen) {
        depth++;
        pos = nextOpen + 1;
      } else if (nextOpen !== -1 && nextOpen < nextClose) {
        // Skip `<fields>` false positives (prefix match on `<field`).
        pos = nextOpen + 1;
      } else {
        depth--;
        if (depth === 0) {
          return xml.substring(0, blockStart) + xml.substring(nextClose + '</field>'.length);
        }
        pos = nextClose + 1;
      }
    }

    return xml;
  }

  /**
   * Schema GET returns &lt;fields&gt; for complex types; schema ADD expects &lt;complex-value&gt;
   * (see Alibaba ICBU publish demo XML).
   */
  private static prepareSchemaForPublish(xml: string, catId: string | number): string {
    let out = xml
      .replace(/<field id="infos"[\s\S]*?<\/field>/g, '')
      .replace(/<label-group[\s\S]*?<\/label-group>/g, '')
      .replace(/<rules>[\s\S]*?<\/rules>/g, '')
      .replace(/<options>[\s\S]*?<\/options>/g, '')
    out = this.removeFieldById(out, 'customizedServices');
    out = this.removeFieldById(out, 'customMoreProperty');
    out = this.removeFieldById(out, 'paymentMethod');
    // Schema templates sometimes embed raw newlines inside quoted attributes.
    out = out.replace(/="([^"]*)\n([^"]*)"/g, '="$1 $2"');

    const innermostFields = /<fields>((?:(?!<fields>)[\s\S])*?)<\/fields>/;
    for (let i = 0; i < 128; i++) {
      if (!innermostFields.test(out)) break;
      out = out.replace(innermostFields, '<complex-value>$1</complex-value>');
    }

    out = this.injectXmlField(out, 'catId', String(catId));
    return out;
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

  /** Read scImages_* slots from schema/render XML (ordered 0..n, skips empty template fields). */
  private static extractSchemaImages(xml: string): { url: string; fileId: string }[] {
    const slots = new Map<number, { url: string; fileId: string }>();
    const fieldRe = /<field id="scImages_(\d+)"[^>]*>([\s\S]*?)<\/field>/g;
    let match: RegExpExecArray | null;
    while ((match = fieldRe.exec(xml)) !== null) {
      if (!match[2].includes('<value')) continue;
      const valueMatch = match[2].match(/<value([^>]*)>([\s\S]*?)<\/value>/);
      if (!valueMatch) continue;
      const fileIdMatch = valueMatch[1].match(/fileId="([^"]*)"/);
      const url = valueMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
      if (!url) continue;
      const index = Number(match[1]);
      if (!slots.has(index)) {
        slots.set(index, {
          url,
          fileId: fileIdMatch?.[1] || '',
        });
      }
    }
    return [...slots.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, img]) => img);
  }

  private static normalizeSourceImageUrl(url: string): string {
    let normalized = url.trim();
    if (normalized.startsWith('//')) normalized = `https:${normalized}`;
    if (!normalized.startsWith('http')) normalized = `https://${normalized}`;
    // Render schema uses thumbnail suffixes like foo.jpg_350x350.jpg — strip the size variant.
    return normalized.replace(/(\.(jpe?g|png|webp))_(\d+)x(\d+)\.\2$/i, '$1');
  }

  /** Upload CDN-only source images to Photobank so publish gets valid fileIds. */
  private static async ensurePhotobankFileIds(
    api: AlibabaAPI,
    images: { url: string; fileId: string }[],
    groupId?: string
  ): Promise<{ url: string; fileId: string }[]> {
    const resolved: { url: string; fileId: string }[] = [];

    for (const img of images) {
      if (img.fileId && img.fileId !== '0') {
        resolved.push({
          url: this.normalizeSourceImageUrl(img.url),
          fileId: img.fileId,
        });
        continue;
      }

      const sourceUrl = this.normalizeSourceImageUrl(img.url);
      const fileName = sourceUrl.split('/').pop()?.split('?')[0] || 'product-image.jpg';
      console.log(`📤 Uploading source image to Photobank: ${fileName}`);
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download source image (${response.status}): ${sourceUrl}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const uploaded = await api.uploadPhotobankImage(fileName, buffer, groupId);
      resolved.push(uploaded);
    }

    return resolved;
  }

  /** Resolve exact source listing images via schema/render + Photobank upload when needed. */
  private static async resolveSourceListingImages(
    api: AlibabaAPI,
    baseProductId: string,
    baseProductCatId: string | number,
    campaign: any,
    pDetails: any
  ): Promise<{ url: string; fileId: string }[]> {
    const groupId = campaign.alibabaListSnapshot?.group_id
      ? String(campaign.alibabaListSnapshot.group_id)
      : undefined;

    try {
      const renderXml = await api.renderProductSchema(baseProductId, baseProductCatId);
      const renderImages = this.extractSchemaImages(renderXml);
      if (renderImages.length) {
        const publishable = await this.ensurePhotobankFileIds(api, renderImages, groupId);
        if (publishable.length) {
          console.log(`🖼️  ${publishable.length} images from source product render schema.`);
          return publishable;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ schema/render image path failed: ${msg}`);
    }

    const withFileId = (images: { url: string; fileId: string }[]) =>
      images.filter((img) => img.url && img.fileId && img.fileId !== '0');

    const fromProduct = withFileId(AlibabaAPI.parseMainImages(pDetails));
    if (fromProduct.length) {
      console.log(`🖼️  ${fromProduct.length} images from source product API (with fileId).`);
      return fromProduct;
    }

    const urlCandidates: string[] = [];
    for (const img of AlibabaAPI.parseMainImages(pDetails)) {
      if (img.url) urlCandidates.push(img.url);
    }
    if (urlCandidates.length === 0 && campaign.images?.length) {
      urlCandidates.push(...campaign.images);
    }

    if (urlCandidates.length > 0) {
      const asRenderImages = urlCandidates.map((url) => ({ url, fileId: '' }));
      try {
        const uploaded = await this.ensurePhotobankFileIds(api, asRenderImages, groupId);
        if (uploaded.length) {
          console.log(`🖼️  ${uploaded.length} images uploaded from source listing URLs.`);
          return uploaded;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Source image upload failed: ${msg}`);
      }

      console.log(`🔍 Matching ${urlCandidates.length} source image URL(s) in Photobank...`);
      const matched = await this.resolvePhotoFileIds(api, urlCandidates);
      if (matched.length) return matched;
    }

    return [];
  }

  private static injectSchemaImages(
    xml: string,
    images: { url: string; fileId: string }[]
  ): string {
    let imgIdx = 0;
    return xml.replace(
      /(<field id="scImages_\d+"[^>]*>)([\s\S]*?)(<\/field>)/g,
      (match, open, inner, close) => {
        if (imgIdx >= images.length) return match;
        const img = images[imgIdx++];
        const withoutValue = inner.replace(/<value[^>]*>[\s\S]*?<\/value>/g, '');
        const escapedUrl = this.escapeXml(img.url);
        const escapedFileId = this.escapeXml(img.fileId);
        const fileIdAttr = img.fileId ? ` fileId="${escapedFileId}"` : '';
        return `${open}${withoutValue}<value${fileIdAttr}>${escapedUrl}</value>${close}`;
      }
    );
  }

  /** Extract a stable image key from Alibaba CDN or Photobank URLs for matching. */
  private static getImageMatchKey(url: string): string {
    const kfMatch = url.match(/\/kf\/([HS][a-zA-Z0-9]+)/i);
    if (kfMatch) return kfMatch[1].toLowerCase();
    const parts = url.split('/');
    const filename = parts[parts.length - 1].split('?')[0];
    return filename.split('.')[0].split('_')[0].toLowerCase();
  }

  private static allTargetHashesResolved(
    targetHashes: Set<string>,
    hashToPhoto: Map<string, { url: string; fileId: string }>
  ): boolean {
    for (const hash of targetHashes) {
      if (!hashToPhoto.has(hash)) return false;
    }
    return true;
  }

  /**
   * Resolve source listing image URLs to Photobank fileIds, preserving input order.
   * Scans paginated Photobank groups until all targets match or pages are exhausted.
   */
  private static async resolvePhotoFileIds(
    api: AlibabaAPI,
    sourceImageUrls: string[]
  ): Promise<{ url: string; fileId: string }[]> {
    if (!sourceImageUrls?.length) return [];

    const targetHashes = new Set(sourceImageUrls.map((url) => this.getImageMatchKey(url)));
    const hashToPhoto = new Map<string, { url: string; fileId: string }>();

    const registerPhoto = (photo: { url?: string; id?: string | number }) => {
      if (!photo.url || photo.id == null) return;
      const entry = { url: photo.url, fileId: String(photo.id) };
      const photoKey = this.getImageMatchKey(photo.url);
      if (targetHashes.has(photoKey) && !hashToPhoto.has(photoKey)) {
        hashToPhoto.set(photoKey, entry);
      }
      const lowerUrl = photo.url.toLowerCase();
      for (const targetHash of targetHashes) {
        if (!hashToPhoto.has(targetHash) && lowerUrl.includes(targetHash)) {
          hashToPhoto.set(targetHash, entry);
        }
      }
    };

    try {
      const groupsResult = await api.listPhotobankGroups();
      const groups =
        groupsResult.alibaba_icbu_photobank_group_list_response?.result?.groups ||
        groupsResult.result?.groups || [];

      const allGroups = [...groups.map((g: any) => String(g.id)), '-1', '0', ''];

      outer: for (const groupId of allGroups) {
        for (let page = 1; page <= 10; page++) {
          const imgResult = await api.listPhotobankImages(groupId, page, 100);
          const photoList =
            imgResult.alibaba_icbu_photobank_list_response?.photo_list?.photo ||
            imgResult.result?.photo_list?.photo ||
            imgResult.result?.pagination_query_list?.list || [];

          if (!Array.isArray(photoList) || photoList.length === 0) break;

          for (const photo of photoList) {
            registerPhoto(photo);
          }

          if (this.allTargetHashesResolved(targetHashes, hashToPhoto)) break outer;
        }
      }
    } catch (e) {
      console.error('⚠️ Error during photobank URL matching:', e);
      return [];
    }

    const ordered = sourceImageUrls
      .map((url) => hashToPhoto.get(this.getImageMatchKey(url)))
      .filter((img): img is { url: string; fileId: string } => Boolean(img));

    if (ordered.length === 0) {
      console.log(`📷 Photobank match: 0/${sourceImageUrls.length} source listing images.`);
      return [];
    }

    if (ordered.length < sourceImageUrls.length) {
      console.log(
        `📷 Photobank partial match: ${ordered.length}/${sourceImageUrls.length} source listing images.`
      );
    } else {
      console.log(`📷 Resolved ${ordered.length}/${sourceImageUrls.length} source listing images from Photobank.`);
    }

    return ordered;
  }

  // ── Core Listing Flow ─────────────────────────────────────────────────────

  private static async executeListing(campaign: any): Promise<ListingAttemptResult> {
    try {
      // 1. Generate AI-optimized content variation
      const optimized = await optimizeProduct(campaign.template, true);

      // 2. Get authenticated API client
      const api = await this.getApiClient();
      if (!api) {
        console.log(`⏭️  Skipping ${campaign.name} — no valid API client.`);
        return { ok: false, reason: 'Not connected to Alibaba' };
      }

      // 3. Fetch base product schema to clone
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
        return { ok: false, reason: 'No base product to clone' };
      }

      console.log(`🔁 Cloning base schema ID: ${baseProductId} (Category: ${baseProductCatId})`);
      let baseXml = '';
      let pDetails: any = {};
      try {
        baseXml = await api.getProductSchema(baseProductId, String(baseProductCatId));
        if (!baseXml) throw new Error('Empty schema returned');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ Failed to get base schema for ${baseProductId}`, e);
        return { ok: false, reason: `Could not load product schema: ${msg}` };
      }

      try {
        const detailRes = await api.getProduct(baseProductId);
        pDetails =
          detailRes?.alibaba_icbu_product_get_response?.product ||
          detailRes?.result?.product ||
          {};
        console.log(`✅ Retrieved base product details.`);
      } catch (e: any) {
        console.warn(`⚠️ Failed to retrieve base product details: ${e.message}. Using template fallbacks.`);
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

      // 5c. Product images — exact image set from the source listing being duplicated
      const sourceImages = await this.resolveSourceListingImages(
        api,
        baseProductId,
        baseProductCatId,
        campaign,
        pDetails
      );
      if (sourceImages.length) {
        baseXml = this.injectSchemaImages(baseXml, sourceImages);
        console.log(
          `🖼️  Injected ${sourceImages.length} images from source listing (product ${baseProductId}).`
        );
      } else {
        console.warn(`⚠️ No publishable images for ${campaign.name} (product ${baseProductId}).`);
        return {
          ok: false,
          reason:
            'Main photo missing — could not load image fileIds from the source product. ' +
            'Ensure the Alibaba product/get API is authorized and the source listing still has images.',
        };
      }

      // 5d. All structured product attributes (Critical → High priority)
      console.log('📋 Injecting structured attributes:');
      baseXml = this.injectStructuredAttributes(baseXml, campaign);

      console.log('📋 Injecting wholesale pricing:');
      baseXml = this.injectWholesalePricing(baseXml, campaign, pDetails);

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
      const pType = campaign.template.productType;
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
        const kw = this.sanitizeKeyword(
          keywordsList[idx] || defaultKeywords[idx] || 'Coffee Beans'
        );
        baseXml = this.injectXmlField(baseXml, `productKeywords_${idx}`, kw);
        console.log(`  ✓ [productKeywords_${idx}] = "${kw}"`);
      }

      // 5e-3. Ladder Period (Shipping/lead times) — fill up to 3 tiers
      const periods = pDetails.wholesaleTrade?.deliverPeriods || [];
      const periodTiers: Array<{ quantity: string; day: string }> = [];
      if (Array.isArray(periods) && periods.length > 0) {
        for (const period of periods.slice(0, 3)) {
          periodTiers.push({
            quantity: String(period.quantity || '10000'),
            day: String(period.processPeriod || period.day || '15'),
          });
        }
      }
      while (periodTiers.length < 2) {
        const last = periodTiers[periodTiers.length - 1];
        periodTiers.push(
          last
            ? {
                quantity: String(Number(last.quantity) * 2 || 20000),
                day: String(Number(last.day) + 5 || 20),
              }
            : { quantity: '10000', day: '15' }
        );
      }
      while (periodTiers.length < 3) {
        const last = periodTiers[periodTiers.length - 1];
        periodTiers.push({
          quantity: String(Number(last.quantity) * 5 || 50000),
          day: String(Number(last.day) + 10 || 25),
        });
      }
      periodTiers.slice(0, 3).forEach((period, idx) => {
        baseXml = this.injectComplexSubField(baseXml, `ladderPeriod_${idx}`, period);
        console.log(`  ✓ [ladderPeriod_${idx}] = qty:${period.quantity}, days:${period.day}`);
      });

      this.writeDebugPayload('post-payload-raw.xml', baseXml);
      const publishXml = this.prepareSchemaForPublish(baseXml, baseProductCatId);
      this.writeDebugPayload('post-payload.xml', publishXml);

      // ── 6. POST to Alibaba ────────────────────────────────────────────────
      const result = await api.addProductSchema(Number(baseProductCatId), publishXml);

      if (result?.result?.success === false) {
        const errCode = result.result.msg_code || 'UNKNOWN';
        const errMsg = (result.result.message_info || result.result.message || '').substring(0, 200);
        console.error(`❌ Listing FAILED for ${campaign.name}. API error [${errCode}]: ${errMsg}`);
        return { ok: false, reason: `Alibaba API [${errCode}]: ${errMsg || 'Unknown error'}` };
      }

      const productId =
        result?.result?.data ||
        result?.result?.product_id ||
        result?.data ||
        result?.alibaba_icbu_product_schema_add_response?.product_id;

      if (!productId && result?.result?.success !== true) {
        const hint = JSON.stringify(result).substring(0, 180);
        console.error(`❌ Listing response unclear for ${campaign.name}:`, hint);
        return { ok: false, reason: 'Alibaba did not return a product ID' };
      }

      console.log(`✅ Listing successful for ${campaign.name}. Product ID: ${productId}`);

      campaign.lastRun = new Date().toISOString();
      CampaignManager.saveCampaign(campaign);
      return { ok: true };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Automation failed for ${campaign.name}:`, error);
      return { ok: false, reason: msg };
    }
  }
}
