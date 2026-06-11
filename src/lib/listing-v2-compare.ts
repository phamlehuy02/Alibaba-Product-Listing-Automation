/**
 * Compare two listing snapshots (V2 product_info JSON or schema XML drafts).
 */
import { AlibabaAPI } from './alibaba-api';
import { canonicalDescriptionForCompare } from './listing-v2-normalizer';
import { extractSchemaFieldMap, extractSchemaImages } from './schema-listing-xml';
import type { ProductInfoV2 } from './listing-v2-types';

export type ListingSnapshot = {
  fetchedAt: string;
  productId: string;
  categoryId: string;
  subject: string;
  descriptionHtml: string;
  images: string[];
  fields: Record<string, string>;
  rawProductInfo: ProductInfoV2;
};

export type ListingComparisonRow = {
  path: string;
  label: string;
  left: string;
  right: string;
  status: 'same' | 'different' | 'left_only' | 'right_only';
};

const SKIP_COMPARE_KEYS = new Set([
  'product_id',
  'gmt_create',
  'gmt_modified',
  'gmt_create_time',
  'gmt_modified_time',
  'create_timestamp',
  'last_modified_timestamp',
]);

function imageBasenameForCompare(url: string): string {
  const file = url.split('/').pop()?.split('?')[0] ?? url;
  return file.replace(/(\.(jpe?g|png|webp))_\d+x\d+\.\2$/i, '$1');
}

/** Normalize field values so equivalent listings compare as same. */
export function canonicalCompareValue(path: string, value: string): string {
  if (!value) return value;

  if (path === 'basic_info.description' || path.endsWith('.description')) {
    return canonicalDescriptionForCompare(value);
  }

  if (path === 'category_info.attributes' || path.endsWith('.attributes')) {
    try {
      const arr = JSON.parse(value) as Array<Record<string, unknown>>;
      if (Array.isArray(arr)) {
        const sorted = [...arr].sort((a, b) =>
          String(a.attribute_name ?? '').localeCompare(String(b.attribute_name ?? ''))
        );
        return JSON.stringify(sorted);
      }
    } catch {
      /* keep raw */
    }
  }

  if (path === 'basic_info.product_images' || path.includes('product_image')) {
    try {
      const arr = JSON.parse(value) as Array<Record<string, unknown>>;
      if (Array.isArray(arr)) {
        const keys = arr
          .map((img) => {
            const url = String(img.image_url ?? img.url ?? img.imageUrl ?? '');
            const sort = img.sort ?? img.image_sort ?? img.imageSort ?? '';
            return `${imageBasenameForCompare(url)}@${sort}`;
          })
          .sort();
        return JSON.stringify(keys);
      }
    } catch {
      /* keep raw */
    }
  }

  return value;
}

function flattenObject(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj == null) return out;
  if (typeof obj !== 'object') {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    out[prefix || '[]'] = JSON.stringify(obj);
    return out;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (SKIP_COMPARE_KEYS.has(key)) continue;
    if (value != null && typeof value === 'object') {
      Object.assign(out, flattenObject(value, path));
    } else if (value !== undefined && value !== null && value !== '') {
      out[path] = String(value);
    }
  }
  return out;
}

export function buildListingSnapshotFromSchemaXml(
  productId: string,
  xml: string,
  categoryId = '100009031'
): ListingSnapshot {
  const schemaFields = extractSchemaFieldMap(xml);
  const subject =
    schemaFields.productTitle ||
    schemaFields.title ||
    productId;
  const images = extractSchemaImages(xml).map((i) => i.url);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(schemaFields)) {
    fields[`schema.${key}`] = value;
  }

  return {
    fetchedAt: new Date().toISOString(),
    productId,
    categoryId,
    subject,
    descriptionHtml: schemaFields.productDescType === '1' ? '[smart editing]' : schemaFields.superText || '',
    images,
    fields,
    rawProductInfo: { schema_xml: true, ...schemaFields } as ProductInfoV2,
  };
}

export function buildListingSnapshotV2(
  productId: string,
  productInfo: ProductInfoV2
): ListingSnapshot {
  const categoryId = String(productInfo.category_id ?? productInfo.categoryId ?? '');
  const subject = AlibabaAPI.getProductTitle(productInfo);
  const images = AlibabaAPI.parseMainImages(productInfo).map((i) => i.url);
  const descriptionHtml = AlibabaAPI.extractProductDescription(productInfo);

  return {
    fetchedAt: new Date().toISOString(),
    productId,
    categoryId,
    subject,
    descriptionHtml,
    images,
    fields: flattenObject(productInfo),
    rawProductInfo: productInfo,
  };
}

export function compareListingSnapshotsV2(
  left: ListingSnapshot,
  right: ListingSnapshot
): ListingComparisonRow[] {
  const keys = new Set([...Object.keys(left.fields), ...Object.keys(right.fields)]);
  const rows: ListingComparisonRow[] = [];

  for (const path of [...keys].sort()) {
    const l = left.fields[path];
    const r = right.fields[path];
    const lc = l === undefined ? undefined : canonicalCompareValue(path, l);
    const rc = r === undefined ? undefined : canonicalCompareValue(path, r);
    let status: ListingComparisonRow['status'] = 'same';
    if (lc === undefined && rc !== undefined) status = 'right_only';
    else if (lc !== undefined && rc === undefined) status = 'left_only';
    else if (lc !== rc) status = 'different';

    rows.push({
      path,
      label: path,
      left: l ?? '',
      right: r ?? '',
      status,
    });
  }
  return rows;
}
