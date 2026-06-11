import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { AlibabaAPI } from './alibaba-api';
import {
  PhotobankIndex,
  resolveDefaultPhotobankGroupId,
} from './listing-v2-normalizer';
import { normalizeSourceImageUrl } from './schema-listing-xml';

const IMAGE_DIR = path.join(process.cwd(), 'scratch', 'playwright-images');
export const MAIN_IMAGE_SLOT_LIMIT = 6;

export type ManifestImage = {
  sort: number;
  sourceUrl: string;
  sourceFileId: string;
  resolvedFileId: string;
  resolvedUrl: string;
  localPath: string;
  uploadFileName: string;
  sha256: string;
};

export type ImageManifest = {
  sourceId: string;
  images: ManifestImage[];
  createdAt: string;
};

function extensionFromUrl(url: string): string {
  if (/\.png/i.test(url)) return 'png';
  if (/\.webp/i.test(url)) return 'webp';
  return 'jpg';
}

function isValidFileId(fileId: string): boolean {
  return Boolean(fileId && fileId !== '0');
}

async function fetchWithTimeout(url: string, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** @deprecated Use ImageManifest — kept for transitional imports */
export type PreparedPlaywrightImages = {
  sourceId: string;
  localPaths: string[];
  photobankFileNames: string[];
  fileIds: string[];
  imageUrls: string[];
};

export function manifestToLegacyPrepared(manifest: ImageManifest): PreparedPlaywrightImages {
  return {
    sourceId: manifest.sourceId,
    localPaths: manifest.images.map((i) => i.localPath),
    photobankFileNames: manifest.images.map((i) => i.uploadFileName),
    fileIds: manifest.images.map((i) => i.resolvedFileId),
    imageUrls: manifest.images.map((i) => i.resolvedUrl),
  };
}

export async function prepareSourceImageManifest(
  api: AlibabaAPI,
  sourceId: string,
  options?: {
    photobank?: PhotobankIndex;
    photobankGroupId?: string;
    delayMs?: number;
    maxImages?: number;
  }
): Promise<ImageManifest> {
  console.log(`    Loading product ${sourceId} from API...`);
  const getRes = await api.getProductV2(sourceId);
  const info = AlibabaAPI.extractProductInfoV2(getRes);
  if (!info) throw new Error(`get/v2 returned no product_info for ${sourceId}`);

  const parsed = AlibabaAPI.parseMainImages(info);
  if (!parsed.length) {
    throw new Error(`Source ${sourceId} has no main images`);
  }

  const maxImages = options?.maxImages ?? MAIN_IMAGE_SLOT_LIMIT;
  if (parsed.length > maxImages) {
    console.log(`    Source has ${parsed.length} images — using first ${maxImages} main slots`);
  }
  const selected = parsed.slice(0, maxImages);

  const photobank = options?.photobank ?? new PhotobankIndex();
  console.log(`    Indexing photobank...`);
  await photobank.ensureLoaded(api);

  console.log(`    Resolving photobank group...`);
  const groupId = options?.photobankGroupId ?? (await resolveDefaultPhotobankGroupId(api));
  const outDir = path.join(IMAGE_DIR, sourceId);
  fs.mkdirSync(outDir, { recursive: true });

  const images: ManifestImage[] = [];
  const delayMs = options?.delayMs ?? 400;

  for (let i = 0; i < selected.length; i++) {
    const sort = i + 1;
    const sourceUrl = normalizeSourceImageUrl(selected[i].url);
    const sourceFileId = String(selected[i].fileId ?? '');
    const ext = extensionFromUrl(sourceUrl);
    const uploadFileName = `listing-${sourceId}-${sort}.${ext}`;
    const localPath = path.join(outDir, uploadFileName);

    console.log(`    Image ${sort}/${selected.length}: downloading...`);
    const response = await fetchWithTimeout(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image ${sourceUrl}: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = sha256(buffer);
    fs.writeFileSync(localPath, buffer);

    let resolvedFileId = '';
    let resolvedUrl = sourceUrl;

    if (isValidFileId(sourceFileId)) {
      resolvedFileId = sourceFileId;
    } else {
      resolvedFileId = photobank.lookup(sourceUrl) ?? '';
    }

    if (!resolvedFileId) {
      console.log(`    Image ${sort}/${selected.length}: uploading to photobank...`);
      const uploaded = await api.uploadPhotobankImage(uploadFileName, buffer, groupId);
      resolvedFileId = uploaded.fileId;
      resolvedUrl = uploaded.url;
      photobank.register(resolvedUrl, resolvedFileId);
      photobank.register(sourceUrl, resolvedFileId);
    }

    images.push({
      sort,
      sourceUrl,
      sourceFileId,
      resolvedFileId,
      resolvedUrl,
      localPath,
      uploadFileName,
      sha256: hash,
    });

    if (delayMs > 0 && i < selected.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const manifest: ImageManifest = {
    sourceId,
    images,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** @deprecated Use prepareSourceImageManifest */
export async function prepareSourceImagesForPlaywright(
  api: AlibabaAPI,
  sourceId: string,
  options?: { photobankGroupId?: string; delayMs?: number }
): Promise<PreparedPlaywrightImages> {
  const manifest = await prepareSourceImageManifest(api, sourceId, options);
  return manifestToLegacyPrepared(manifest);
}
