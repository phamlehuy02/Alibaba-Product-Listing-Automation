import { readFileSync } from 'fs';
import path from 'path';

export type Bucket =
  | 'product_noun'
  | 'variety'
  | 'processing'
  | 'grade'
  | 'origin'
  | 'pack'
  | 'cert'
  | 'brand'
  | 'filler'
  | 'neutral';

export interface TitleVocabulary {
  phrases: string[];
  buckets: Record<string, string[]>;
  movableBuckets: string[];
  anchorBuckets: string[];
}

export interface RearrangeResult {
  title: string;
  editApplied: string;
  sourceTitle: string;
}

const VOCAB_PATH = path.join(process.cwd(), 'data', 'title-vocabulary.json');
const MAX_TITLE_BYTES = 128;

/** Alibaba productTitle forbidden charset (from category schema). */
const FORBIDDEN_CHAR_RE =
  /[^\x20-\x7E\xA0-\xFF\u0370-\u03FF\u2010-\u2049\u2070-\u209F\u2100-\u213B\u2200-\u22FF≤≥‰±㎡℃℉°²³]/u;
const EMAIL_RE = /\w+(?:[\-+.]\w+)*@\w+(?:[\-.]\w+)*\.\w+(?:[\-.]\w+)*/;
const HTML_RE = /<[^>]+>/;

const BUCKET_PRIORITY: Bucket[] = [
  'product_noun',
  'variety',
  'processing',
  'grade',
  'origin',
  'pack',
  'cert',
  'brand',
  'filler',
  'neutral',
];

let cachedVocab: TitleVocabulary | null = null;

export function loadTitleVocabulary(): TitleVocabulary {
  if (cachedVocab) return cachedVocab;
  const raw = readFileSync(VOCAB_PATH, 'utf-8');
  cachedVocab = JSON.parse(raw) as TitleVocabulary;
  cachedVocab.phrases = [...cachedVocab.phrases].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
  return cachedVocab;
}

export function trimToUtf8Bytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf-8') <= maxBytes) return text;
  const tokens = text.split(/\s+/).filter(Boolean);
  while (tokens.length > 0) {
    tokens.pop();
    const candidate = tokens.join(' ');
    if (Buffer.byteLength(candidate, 'utf-8') <= maxBytes) return candidate;
  }
  let out = '';
  for (const ch of text) {
    const next = out + ch;
    if (Buffer.byteLength(next, 'utf-8') > maxBytes) break;
    out = next;
  }
  return out;
}

export function validateAlibabaTitle(title: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, reason: 'Title is empty' };
  if (Buffer.byteLength(trimmed, 'utf-8') > MAX_TITLE_BYTES) {
    return { ok: false, reason: `Title exceeds ${MAX_TITLE_BYTES} UTF-8 bytes` };
  }
  if (HTML_RE.test(trimmed)) return { ok: false, reason: 'Title contains HTML' };
  if (EMAIL_RE.test(trimmed)) return { ok: false, reason: 'Title contains email pattern' };
  if (FORBIDDEN_CHAR_RE.test(trimmed)) return { ok: false, reason: 'Title contains forbidden characters' };
  return { ok: true };
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function tokenKey(token: string): string {
  return token.toLowerCase();
}

/** Longest-match phrase tokenization; preserves source casing. */
export function tokenizeTitle(title: string, vocab: TitleVocabulary): string[] {
  const phrases = vocab.phrases;
  const tokens: string[] = [];
  let pos = 0;
  const src = title;

  while (pos < src.length) {
    while (pos < src.length && src[pos] === ' ') pos++;
    if (pos >= src.length) break;

    let matched = false;
    for (const phrase of phrases) {
      if (pos + phrase.length > src.length) continue;
      const slice = src.slice(pos, pos + phrase.length);
      if (slice.toLowerCase() !== phrase.toLowerCase()) continue;
      const after = pos + phrase.length;
      if (after < src.length && src[after] !== ' ') continue;
      tokens.push(slice);
      pos = after;
      matched = true;
      break;
    }

    if (!matched) {
      let end = src.indexOf(' ', pos);
      if (end === -1) end = src.length;
      const word = src.slice(pos, end);
      if (word) tokens.push(word);
      pos = end;
    }
  }

  return tokens;
}

export function classifyToken(token: string, vocab: TitleVocabulary): Bucket {
  const lower = token.toLowerCase();
  for (const bucket of BUCKET_PRIORITY) {
    if (bucket === 'neutral') continue;
    const entries = vocab.buckets[bucket] || [];
    if (entries.some((e) => e.toLowerCase() === lower)) return bucket;
  }
  return 'neutral';
}

function isMovable(bucket: Bucket, vocab: TitleVocabulary): boolean {
  return vocab.movableBuckets.includes(bucket);
}

function joinTokens(tokens: string[]): string {
  return tokens.join(' ');
}

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(tokenKey).sort();
  const sb = b.map(tokenKey).sort();
  return sa.every((v, i) => v === sb[i]);
}

/** Whitespace word multiset — stable under phrase re-tokenization after reorder. */
export function wordsMultisetEqual(a: string, b: string): boolean {
  const wa = a.trim().split(/\s+/).filter(Boolean).map(tokenKey).sort();
  const wb = b.trim().split(/\s+/).filter(Boolean).map(tokenKey).sort();
  if (wa.length !== wb.length) return false;
  return wa.every((v, i) => v === wb[i]);
}

function hashProductId(productId: string): number {
  let h = 0;
  for (let i = 0; i < productId.length; i++) {
    h = (h * 31 + productId.charCodeAt(i)) >>> 0;
  }
  return h;
}

type EditFn = (tokens: string[], vocab: TitleVocabulary) => { tokens: string[]; label: string } | null;

function moveTokenToEnd(tokens: string[], index: number): string[] {
  if (index < 0 || index >= tokens.length) return [...tokens];
  const out = [...tokens];
  const [t] = out.splice(index, 1);
  out.push(t);
  return out;
}

function swapTokens(tokens: string[], i: number, j: number): string[] {
  const out = [...tokens];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const EDITS: EditFn[] = [
  // Move trailing brand at front to end
  (tokens, vocab) => {
    if (tokens.length < 2) return null;
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    const firstBrand = buckets.findIndex((b) => b === 'brand');
    if (firstBrand <= 0) return null;
    return { tokens: moveTokenToEnd(tokens, firstBrand), label: 'move_brand_to_end' };
  },
  // Move first movable filler/cert to end
  (tokens, vocab) => {
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    const idx = buckets.findIndex((b) => isMovable(b, vocab));
    if (idx < 0 || idx === tokens.length - 1) return null;
    return { tokens: moveTokenToEnd(tokens, idx), label: 'move_first_movable_to_end' };
  },
  // Move last movable to end (if not already last)
  (tokens, vocab) => {
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (isMovable(buckets[i], vocab)) {
        if (i === tokens.length - 1) return null;
        return { tokens: moveTokenToEnd(tokens, i), label: 'move_movable_to_end' };
      }
    }
    return null;
  },
  // Swap first two movable tokens
  (tokens, vocab) => {
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    const movableIdx: number[] = [];
    for (let i = 0; i < buckets.length; i++) {
      if (isMovable(buckets[i], vocab)) movableIdx.push(i);
    }
    if (movableIdx.length < 2) return null;
    return {
      tokens: swapTokens(tokens, movableIdx[0], movableIdx[1]),
      label: 'swap_first_two_movable',
    };
  },
  // Swap adjacent movable pair
  (tokens, vocab) => {
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    for (let i = 0; i < tokens.length - 1; i++) {
      if (isMovable(buckets[i], vocab) && isMovable(buckets[i + 1], vocab)) {
        return { tokens: swapTokens(tokens, i, i + 1), label: 'swap_adjacent_movable' };
      }
    }
    return null;
  },
  // Rotate last movable one position left
  (tokens, vocab) => {
    const buckets = tokens.map((t) => classifyToken(t, vocab));
    for (let i = tokens.length - 1; i > 0; i--) {
      if (isMovable(buckets[i], vocab)) {
        return { tokens: swapTokens(tokens, i - 1, i), label: 'rotate_movable_left' };
      }
    }
    return null;
  },
  // Swap first and last token (minimal single swap)
  (tokens) => {
    if (tokens.length < 2) return null;
    return { tokens: swapTokens(tokens, 0, tokens.length - 1), label: 'swap_first_last' };
  },
  // Swap first two tokens
  (tokens) => {
    if (tokens.length < 2) return null;
    return { tokens: swapTokens(tokens, 0, 1), label: 'swap_first_two' };
  },
];

function applyEditAtVariant(
  tokens: string[],
  vocab: TitleVocabulary,
  sourceNormalized: string,
  variant: number
): { tokens: string[]; label: string } | null {
  const candidates: Array<{ tokens: string[]; label: string }> = [];

  for (let editIndex = 0; editIndex < EDITS.length; editIndex++) {
    const result = EDITS[editIndex](tokens, vocab);
    if (!result) continue;
    if (!multisetEqual(result.tokens, tokens)) continue;
    const joined = normalizeTitle(joinTokens(result.tokens));
    if (joined === sourceNormalized) continue;
    candidates.push({ tokens: result.tokens, label: result.label });
  }

  if (candidates.length === 0) return null;
  return candidates[variant % candidates.length];
}

function relocateExistingWord(tokens: string[], word: string, toEnd: boolean): string[] | null {
  const key = word.toLowerCase();
  const indices: number[] = [];
  tokens.forEach((t, i) => {
    if (tokenKey(t) === key) indices.push(i);
  });
  if (indices.length === 0) return null;
  const idx = toEnd ? indices[0] : indices[indices.length - 1];
  if (toEnd && idx === tokens.length - 1) return null;
  if (!toEnd && idx === 0) return null;
  return toEnd ? moveTokenToEnd(tokens, idx) : moveTokenToEnd(moveTokenToEnd(tokens, idx), 0);
}

export function rearrangeTitleMinimal(
  sourceTitle: string,
  productId: string,
  variantOffset = 0
): RearrangeResult {
  const vocab = loadTitleVocabulary();
  const normalizedSource = normalizeTitle(sourceTitle);
  const sourceTokens = tokenizeTitle(normalizedSource, vocab);

  if (sourceTokens.length === 0) {
    throw new Error('Cannot rearrange empty source title');
  }

  const baseVariant = hashProductId(productId) + variantOffset;

  for (let attempt = 0; attempt < EDITS.length + 4; attempt++) {
    const variant = baseVariant + attempt;
    const edit = applyEditAtVariant(sourceTokens, vocab, normalizedSource, variant);
    if (!edit) continue;

    const candidate = trimToUtf8Bytes(
      normalizeTitle(joinTokens(edit.tokens)),
      MAX_TITLE_BYTES
    );
    if (candidate === normalizedSource) continue;

    const validation = validateAlibabaTitle(candidate);
    if (!validation.ok) continue;

    if (!multisetEqual(edit.tokens, sourceTokens)) continue;

    return {
      title: candidate,
      editApplied: edit.label,
      sourceTitle: normalizedSource,
    };
  }

  // Last resort: move an existing "Wholesale" or brand token if present
  for (const word of ['Wholesale', 'Konnai', 'Detech', 'OEM']) {
    const relocated = relocateExistingWord(sourceTokens, word, true);
    if (!relocated) continue;
    const candidate = trimToUtf8Bytes(normalizeTitle(joinTokens(relocated)), MAX_TITLE_BYTES);
    if (candidate !== normalizedSource && validateAlibabaTitle(candidate).ok) {
      return {
        title: candidate,
        editApplied: `relocate_${word.toLowerCase()}`,
        sourceTitle: normalizedSource,
      };
    }
  }

  throw new Error(
    `Could not produce a distinct valid title for product ${productId}: "${normalizedSource.substring(0, 60)}..."`
  );
}

/** Batch helper: bump variant when two listings would share the same title. */
export function rearrangeTitleMinimalUnique(
  sourceTitle: string,
  productId: string,
  usedTitles: Set<string>
): RearrangeResult {
  for (let offset = 0; offset < 16; offset++) {
    const result = rearrangeTitleMinimal(sourceTitle, productId, offset);
    if (!usedTitles.has(result.title)) {
      usedTitles.add(result.title);
      return result;
    }
  }
  throw new Error(`Could not find unique rearranged title for product ${productId}`);
}
