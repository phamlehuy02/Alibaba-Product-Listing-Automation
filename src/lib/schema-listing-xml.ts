/**
 * XML helpers for ICBU schema/render → schema/add/draft duplication.
 */
import type { AlibabaAPI } from './alibaba-api';

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function injectXmlField(
  xml: string,
  fieldId: string,
  value: string,
  extraAttrs = ''
): string {
  const isCdata = value.startsWith('<![CDATA[') && value.endsWith(']]>');
  const escapedValue = isCdata ? value : escapeXml(value);
  const pattern = new RegExp(
    `(<field id="${fieldId}"[^>]*>)([\\s\\S]*?)(<\\/field>)`,
    'g'
  );
  return xml.replace(pattern, (_match, open: string, inner: string, close: string) => {
    const withoutValue = inner.replace(/<value[^>]*>[\s\S]*?<\/value>/g, '');
    return `${open}${withoutValue}<value${extraAttrs ? ` ${extraAttrs}` : ''}>${escapedValue}</value>${close}`;
  });
}

export function extractSchemaImages(xml: string): { url: string; fileId: string }[] {
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
      slots.set(index, { url, fileId: fileIdMatch?.[1] || '' });
    }
  }
  return [...slots.entries()].sort(([a], [b]) => a - b).map(([, img]) => img);
}

export function normalizeSourceImageUrl(url: string): string {
  let normalized = url.trim();
  if (normalized.startsWith('//')) normalized = `https:${normalized}`;
  if (!normalized.startsWith('http')) normalized = `https://${normalized}`;
  return normalized.replace(/(\.(jpe?g|png|webp))_(\d+)x(\d+)\.\2$/i, '$1');
}

export async function ensurePhotobankFileIds(
  api: AlibabaAPI,
  images: { url: string; fileId: string }[],
  groupId?: string,
  delayMs = 400
): Promise<{ url: string; fileId: string }[]> {
  const resolved: { url: string; fileId: string }[] = [];
  for (const img of images) {
    if (img.fileId && img.fileId !== '0') {
      resolved.push({
        url: normalizeSourceImageUrl(img.url),
        fileId: img.fileId,
      });
      continue;
    }
    const sourceUrl = normalizeSourceImageUrl(img.url);
    const fileName = sourceUrl.split('/').pop()?.split('?')[0] || 'product-image.jpg';
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download source image (${response.status}): ${sourceUrl}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const uploaded = await api.uploadPhotobankImage(fileName, buffer, groupId);
    resolved.push(uploaded);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return resolved;
}

export function injectSchemaImages(
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
      const escapedUrl = escapeXml(normalizeSourceImageUrl(img.url));
      const escapedFileId = escapeXml(img.fileId);
      const fileIdAttr = img.fileId ? ` fileId="${escapedFileId}"` : '';
      return `${open}${withoutValue}<value${fileIdAttr}>${escapedUrl}</value>${close}`;
    }
  );
}

/** Flat map of schema field id → first value text (for compare / snapshots). */
export function extractSchemaFieldMap(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const fieldRe = /<field id="([^"]+)"[^>]*>([\s\S]*?)<\/field>/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(xml)) !== null) {
    const fieldId = match[1];
    const inner = match[2];
    const valueMatch = inner.match(/<value([^>]*)>([\s\S]*?)<\/value>/);
    if (!valueMatch) {
      if (inner.includes('<complex-value>')) out[fieldId] = '[complex]';
      continue;
    }
    const text = valueMatch[2]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (text) out[fieldId] = text;
  }
  return out;
}

/** MOQ from ladderPrice_0.quantity in schema/render XML. */
export function extractLadderMoq(xml: string): string | null {
  const match = xml.match(
    /<field id="ladderPrice_0"[^>]*>[\s\S]*?<field id="quantity"[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/
  );
  if (!match) return null;
  const qty = match[1].trim().replace(/[^\d.]/g, '');
  return qty || null;
}

/** Re-apply trade fields that schema/add/draft often drops (sample service depends on MOQ). */
export function injectMarketTradeFields(
  xml: string,
  options: {
    moq: string;
    samplingQuantity?: string;
    samplingPrice?: string;
  }
): string {
  let out = xml;
  const moq = options.moq.replace(/[^\d.]/g, '') || '1';
  out = injectXmlField(out, 'marketMinOrderQuantity', moq);
  out = injectXmlField(out, 'minOrderQuantity', moq);
  if (options.samplingQuantity) {
    out = injectXmlField(out, 'marketSamplingQuantity', options.samplingQuantity);
  }
  if (options.samplingPrice) {
    out = injectXmlField(out, 'marketSamplingPrice', options.samplingPrice);
  }
  return out;
}

/** Live publish rejects descriptions with more than 30 inline images. */
export function capDescriptionImages(html: string, maxImages = 30): string {
  let count = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    count += 1;
    return count <= maxImages ? tag : '';
  });
}

/**
 * Alibaba schema API only supports custom HTML descriptions (not smart-editor pageData).
 * Copy source HTML into superText and switch to custom description mode.
 */
export function injectCustomDescription(
  xml: string,
  descriptionHtml: string,
  options?: { maxImages?: number }
): string {
  if (!descriptionHtml.trim()) return xml;
  let html = descriptionHtml;
  if (options?.maxImages != null) {
    html = capDescriptionImages(html, options.maxImages);
  }
  let out = injectXmlField(xml, 'productDescType', '2');
  out = injectXmlField(out, 'superText', `<![CDATA[${html}]]>`);
  return out;
}

/** Minimal schema/update XML fragment for custom description (productDescType=2 + superText). */
export function buildCustomDescriptionUpdateXml(
  descriptionHtml: string,
  options?: { maxImages?: number }
): string {
  let html = descriptionHtml;
  if (options?.maxImages != null) {
    html = capDescriptionImages(html, options.maxImages);
  }
  return `<itemSchema><field id="productDescType" name="Product description" type="singleCheck"><value>2</value></field><field id="superText" name="Regular Editor" type="input"><value><![CDATA[${html}]]></value></field></itemSchema>`;
}

/**
 * Strip schema template noise and convert nested field definitions to complex-value
 * blocks, matching what Alibaba expects on schema/add/draft (from v1 automation-engine).
 */
export function prepareSchemaXmlForPublish(xml: string, catId: string | number): string {
  let out = xml
    .replace(/<field id="infos"[\s\S]*?<\/field>/g, '')
    .replace(/<label-group[\s\S]*?<\/label-group>/g, '')
    .replace(/<rules>[\s\S]*?<\/rules>/g, '')
    .replace(/<options>[\s\S]*?<\/options>/g, '');
  out = out.replace(/="([^"]*)\n([^"]*)"/g, '="$1 $2"');

  const innermostFields = /<fields>((?:(?!<fields>)[\s\S])*?)<\/fields>/;
  for (let i = 0; i < 128; i++) {
    if (!innermostFields.test(out)) break;
    out = out.replace(innermostFields, '<complex-value>$1</complex-value>');
  }

  return injectXmlField(out, 'catId', String(catId));
}

export function clearProductKeywords(xml: string): string {
  let out = xml;
  for (let i = 0; i < 3; i++) {
    out = injectXmlField(out, `productKeywords_${i}`, '');
  }
  const complexPattern = /<field id="productKeywords"[^>]*>[\s\S]*?<\/field>/;
  if (complexPattern.test(out)) {
    out = out.replace(
      complexPattern,
      (block) => block.replace(/<complex-value>[\s\S]*?<\/complex-value>/, '<complex-value></complex-value>')
    );
  }
  return out;
}
