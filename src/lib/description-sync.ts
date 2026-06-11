/**
 * Copy product description HTML from a source listing onto a clone.
 *
 * pageData / smart-editing JSON is only available from get/v2 on the source.
 * Alibaba Open API documents custom HTML only (productDescType=2 + superText);
 * smart-editor wire format cannot be written back via schema or listing/v2.
 */
import { AlibabaAPI } from './alibaba-api';
import {
  canonicalDescriptionForCompare,
  parseSmartEditorDescription,
  unwrapDescriptionHtml,
} from './listing-v2-normalizer';
import { buildCustomDescriptionUpdateXml } from './schema-listing-xml';

export type DescriptionSyncResult = {
  sourceId: string;
  cloneId: string;
  canonicalMatch: boolean;
  wireFormatMatch: boolean;
  sourceWireFormat: 'smart-json' | 'custom-html' | 'empty';
  cloneWireFormat: 'smart-json' | 'custom-html' | 'empty';
  sourceHtmlChars: number;
  cloneHtmlChars: number;
  pageDataAvailable: boolean;
  pageDataChars: number;
  updateApplied: boolean;
  message: string;
};

function wireFormat(raw: unknown): DescriptionSyncResult['sourceWireFormat'] {
  if (raw == null || String(raw).trim() === '') return 'empty';
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('{')) return 'smart-json';
  return 'custom-html';
}

/** Read smart-editor payload from get/v2 (only confirmed pageData source). */
export function readSourceDescriptionPayload(sourceInfo: Record<string, unknown>): {
  raw: unknown;
  html: string;
  pageDataChars: number;
  pageId?: number | string;
} {
  const raw = (sourceInfo.basic_info as { description?: unknown } | undefined)?.description;
  const parsed = parseSmartEditorDescription(raw);
  const html = unwrapDescriptionHtml(raw);
  let pageDataChars = 0;
  let pageId: number | string | undefined;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const pageData = (parsed as { pageData?: unknown }).pageData;
    if (pageData != null) pageDataChars = String(pageData).length;
    pageId = (parsed as { pageId?: number | string }).pageId;
  }
  return { raw, html, pageDataChars, pageId };
}

export async function syncCloneDescriptionFromSource(
  api: AlibabaAPI,
  sourceId: string,
  cloneId: string,
  options?: {
    catId?: number;
    maxImages?: number;
    dryRun?: boolean;
  }
): Promise<DescriptionSyncResult> {
  const catId = options?.catId ?? 100009031;
  const maxImages = options?.maxImages ?? 30;

  const sourceInfo = AlibabaAPI.extractProductInfoV2(await api.getProductV2(sourceId));
  const cloneInfo = AlibabaAPI.extractProductInfoV2(await api.getProductV2(cloneId));
  if (!sourceInfo || !cloneInfo) {
    throw new Error('Could not load source or clone product_info from get/v2');
  }

  const source = readSourceDescriptionPayload(sourceInfo as Record<string, unknown>);
  const cloneRaw = (cloneInfo.basic_info as { description?: unknown } | undefined)?.description;

  if (!source.html.trim()) {
    throw new Error(`Source ${sourceId} has no description HTML to copy`);
  }

  const canonicalMatch =
    canonicalDescriptionForCompare(source.raw) === canonicalDescriptionForCompare(cloneRaw);
  const wireFormatMatch = String(source.raw ?? '') === String(cloneRaw ?? '');

  let updateApplied = false;
  let message = canonicalMatch
    ? 'Clone description already matches source (canonical HTML).'
    : 'Clone description differs from source.';

  if (!canonicalMatch && !options?.dryRun) {
    const xml = buildCustomDescriptionUpdateXml(source.html, { maxImages });
    const res = await api.updateProductSchema(cloneId, catId, xml);
    if (res?.result?.success === false) {
      const err =
        res.result?.message_info ||
        res.result?.msg_code ||
        res.result?.message ||
        JSON.stringify(res).substring(0, 300);
      throw new Error(`schema/update failed: ${err}`);
    }
    updateApplied = true;
    message = `Applied custom HTML description via schema/update (max ${maxImages} images).`;

    await new Promise((r) => setTimeout(r, 4000));
    const afterInfo = AlibabaAPI.extractProductInfoV2(await api.getProductV2(cloneId));
    const afterRaw = (afterInfo?.basic_info as { description?: unknown } | undefined)?.description;
    const afterCanonical =
      canonicalDescriptionForCompare(source.raw) === canonicalDescriptionForCompare(afterRaw);
    if (!afterCanonical) {
      message += ' Warning: post-update canonical compare still differs.';
    }
  }

  const finalCloneInfo =
    updateApplied && !options?.dryRun
      ? AlibabaAPI.extractProductInfoV2(await api.getProductV2(cloneId))
      : cloneInfo;
  const finalRaw = (finalCloneInfo?.basic_info as { description?: unknown } | undefined)
    ?.description;

  return {
    sourceId,
    cloneId,
    canonicalMatch:
      updateApplied && !options?.dryRun
        ? canonicalDescriptionForCompare(source.raw) ===
          canonicalDescriptionForCompare(finalRaw)
        : canonicalMatch,
    wireFormatMatch: String(source.raw ?? '') === String(finalRaw ?? ''),
    sourceWireFormat: wireFormat(source.raw),
    cloneWireFormat: wireFormat(finalRaw),
    sourceHtmlChars: source.html.length,
    cloneHtmlChars: unwrapDescriptionHtml(finalRaw).length,
    pageDataAvailable: source.pageDataChars > 0,
    pageDataChars: source.pageDataChars,
    updateApplied,
    message,
  };
}
