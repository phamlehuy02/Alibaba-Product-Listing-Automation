/**
 * Normalize get/v2 product_info into a listing/v2-ready payload.
 */
import { AlibabaAPI } from './alibaba-api';
import { capDescriptionImages } from './schema-listing-xml';
import type { ProductInfoV2 } from './listing-v2-types';

const BASIC_STRIP_FOR_LISTING = new Set([
  'product_id',
  'productId',
  'id',
  'gmt_create',
  'gmt_modified',
  'gmt_create_time',
  'gmt_modified_time',
  'create_timestamp',
  'last_modified_timestamp',
  'status',
  'product_status',
  'audit_status',
  'url',
  'product_url',
  'detail_url',
  'owner_ali_id',
]);

const TOP_STRIP_FOR_LISTING = new Set([
  'product_id',
  'productId',
  'id',
  'gmt_create',
  'gmt_modified',
  'status',
  'product_status',
  'audit_status',
]);

/** Smart-editor descriptions from get/v2 are JSON strings; listing/v2 expects the parsed object. */
export function parseSmartEditorDescription(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

/** HTML inside smart-editor JSON — for display/compare. */
export function unwrapDescriptionHtml(raw: unknown): string {
  const parsed = parseSmartEditorDescription(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const inner = (parsed as { description?: string }).description;
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
  }
  if (typeof parsed === 'string') return parsed.trim();
  return '';
}

/**
 * Canonical description for listing compare.
 * Source smart-editor JSON and clone custom HTML differ on the wire but share the same
 * HTML body; live schema publish caps inline description images at 30.
 */
export function canonicalDescriptionForCompare(raw: unknown): string {
  const html = unwrapDescriptionHtml(raw);
  if (html) return capDescriptionImages(html, 30);
  return String(raw ?? '').trim();
}

export function imageBasename(url: string): string {
  const match = url.match(/\/kf\/([^./?]+)/);
  if (match) return match[1];
  const pathPart = url.split('?')[0].split('/').pop() ?? url;
  return pathPart.replace(/\.(jpe?g|png|webp)$/i, '');
}

function extensionFromUrl(url: string): string {
  if (/\.png/i.test(url)) return 'png';
  if (/\.jpe?g/i.test(url)) return 'jpg';
  if (/\.webp/i.test(url)) return 'webp';
  return 'jpg';
}

export type ListingImageRef = {
  file_id: string;
  image_url: string;
  sort: number;
};

/** In-memory photobank URL → file_id index (built once per batch). */
export class PhotobankIndex {
  private byKey = new Map<string, string>();
  private loaded = false;

  register(url: string, fileId: string): void {
    this.byKey.set(url, fileId);
    this.byKey.set(imageBasename(url), fileId);
  }

  lookup(url: string): string | undefined {
    return this.byKey.get(url) ?? this.byKey.get(imageBasename(url));
  }

  async ensureLoaded(api: AlibabaAPI): Promise<void> {
    if (this.loaded) return;
    const groupsRes = await api.listPhotobankGroups();
    const groups =
      groupsRes?.result?.groups ??
      groupsRes?.alibaba_icbu_photobank_group_list_response?.result?.groups ??
      [];

    for (const group of groups) {
      const groupId = String(group.id ?? group.group_id ?? '');
      if (!groupId) continue;
      for (let page = 1; page <= 40; page++) {
        const res = await api.listPhotobankImages(groupId, page, 50);
        const list =
          res?.result?.pagination_query_list?.list ??
          res?.alibaba_icbu_photobank_list_response?.pagination_query_list?.list ??
          [];
        if (!list.length) break;
        for (const img of list) {
          const fileId = String(img.id ?? img.file_id ?? img.fileId ?? '');
          const url = String(img.url ?? img.photobank_url ?? '');
          if (fileId && url) this.register(url, fileId);
        }
        if (list.length < 50) break;
      }
    }
    this.loaded = true;
  }
}

export async function resolveDefaultPhotobankGroupId(api: AlibabaAPI): Promise<string> {
  const fromEnv = process.env.PHOTOBANK_GROUP_ID?.trim();
  if (fromEnv) return fromEnv;

  const groupsRes = await api.listPhotobankGroups();
  const groups =
    groupsRes?.result?.groups ??
    groupsRes?.alibaba_icbu_photobank_group_list_response?.result?.groups ??
    [];

  const preferred = groups.find((g: { name?: string }) =>
    /roasted/i.test(g.name ?? '')
  );
  const fallback = groups[0];
  const id = preferred?.id ?? fallback?.id;
  if (!id) throw new Error('No photobank group found for image upload.');
  return String(id);
}

export async function resolveProductImagesForListing(
  api: AlibabaAPI,
  imageUrls: string[],
  photobank: PhotobankIndex,
  groupId: string,
  delayMs = 400
): Promise<ListingImageRef[]> {
  await photobank.ensureLoaded(api);
  const out: ListingImageRef[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const sourceUrl = imageUrls[i];
    if (!sourceUrl?.trim()) continue;

    let fileId = photobank.lookup(sourceUrl);
    let imageUrl = sourceUrl;

    if (!fileId) {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image ${sourceUrl}: HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = extensionFromUrl(sourceUrl);
      const uploaded = await api.uploadPhotobankImage(
        `listing-${Date.now()}-${i}.${ext}`,
        buffer,
        groupId
      );
      fileId = uploaded.fileId;
      imageUrl = uploaded.url;
      photobank.register(imageUrl, fileId);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }

    out.push({ file_id: fileId, image_url: imageUrl, sort: i + 1 });
  }

  return out;
}

function stripKeywords(info: ProductInfoV2): void {
  const basic = info.basic_info as Record<string, unknown> | undefined;
  if (basic) {
    delete basic.keywords;
    delete basic.keyword;
    delete basic.product_keywords;
    delete basic.productKeywords;
  }
  delete info.keywords;
  delete info.keyword;
}

export async function normalizeProductInfoForListing(
  api: AlibabaAPI,
  sourceInfo: ProductInfoV2,
  options: {
    seedTitle: string;
    photobank: PhotobankIndex;
    photobankGroupId: string;
  }
): Promise<ProductInfoV2> {
  const product_info = JSON.parse(JSON.stringify(sourceInfo)) as ProductInfoV2;

  for (const key of TOP_STRIP_FOR_LISTING) {
    delete product_info[key];
  }

  stripKeywords(product_info);

  const basic = product_info.basic_info as Record<string, unknown> | undefined;
  if (!basic) {
    throw new Error('product_info.basic_info is required for listing/v2');
  }

  for (const key of BASIC_STRIP_FOR_LISTING) {
    delete basic[key];
  }

  basic.description = parseSmartEditorDescription(basic.description);
  basic.subject = options.seedTitle;
  basic.title = options.seedTitle;

  const imageUrls = AlibabaAPI.parseMainImages(product_info).map((img) => img.url);
  if (!imageUrls.length) {
    throw new Error('Source product has no images — cannot list without product_image');
  }

  basic.product_image = await resolveProductImagesForListing(
    api,
    imageUrls,
    options.photobank,
    options.photobankGroupId
  );
  delete basic.product_images;

  return product_info;
}
