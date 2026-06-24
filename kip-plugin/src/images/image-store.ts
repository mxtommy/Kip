import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import DOMPurify from 'isomorphic-dompurify';
import { snapWidth, inProcessProcessor, type ImageProcessor } from './image-processing';

/**
 * ImageStore — secure, testable core for the KIP image-asset feature.
 *
 * Responsibilities (no Express here, so it is unit-testable with buffers + a temp dir):
 *  - Validate untrusted uploads by CONTENT (magic bytes), not the client extension/MIME.
 *  - Sanitize SVG (DOMPurify) and store it as vector; reject if sanitization empties it.
 *  - Validate raster decodability + dimensions via sharp, guarding decompression bombs.
 *  - Store the ORIGINAL bytes plus a sidecar JSON of metadata (id-addressed).
 *  - List / read metadata / delete.
 *
 * Serving (on-demand WebP re-encode + resize + cache) is layered on top separately; the raw
 * original raster is never served directly.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_INPUT_PIXELS = 50_000_000; // ~50 MP decompression-bomb guard

export type ImageFormat = 'svg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'heic';

const RASTER_FORMATS: readonly ImageFormat[] = ['jpeg', 'png', 'webp', 'gif', 'heic'];

/** sharp `metadata().format` values we accept, mapped to our canonical format key. */
const SHARP_FORMAT_MAP: Record<string, ImageFormat> = {
  jpeg: 'jpeg', jpg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif', heif: 'heic', heic: 'heic'
};

const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  svg: 'svg', jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', heic: 'heic'
};

export interface ImageMeta {
  id: string;
  name: string;          // sanitized display name (original filename, basename only)
  format: ImageFormat;
  width: number | null;  // null for SVG without intrinsic size
  height: number | null;
  bytes: number;         // size of the stored original
  animated: boolean;
  createdAt: string;     // ISO timestamp
  uploadedBy?: string | null;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Detect the real image type from the leading bytes. Returns null for anything not allowed.
 * Magic numbers: PNG, JPEG, GIF87a/89a, RIFF/WEBP, ISO-BMFF `ftyp` HEIC/HEIF brands, or SVG/XML text.
 */
export function detectImageType(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6).match(/^GIF8[79]a$/)) {
    return 'gif';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs', 'mif1', 'msf1', 'heif'].includes(brand)) {
      return 'heic';
    }
  }
  if (looksLikeSvg(buffer)) {
    return 'svg';
  }
  return null;
}

function looksLikeSvg(buffer: Buffer): boolean {
  // Only sniff the head; SVG is text/XML whose document element is <svg>.
  const head = buffer.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart();
  if (!head.startsWith('<')) return false;
  const withoutProlog = head.replace(/^<\?xml[\s\S]*?\?>\s*/, '').replace(/^<!--[\s\S]*?-->\s*/, '').replace(/^<!DOCTYPE[^>]*>\s*/i, '').trimStart();
  return /^<svg[\s>]/i.test(withoutProlog);
}

/** Sanitize an SVG string, stripping scripts, event handlers and external references. */
export function sanitizeSvg(svg: string): string {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['xlink:href'],
    ADD_TAGS: [],
    // Block external resource loads and javascript: URIs.
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
  return typeof clean === 'string' ? clean : String(clean);
}

export interface ServableImage {
  buffer: Buffer;
  contentType: string;
  filename: string;
  headers: Record<string, string>;
}

/** Headers applied to every served image: lock down sniffing + execution, allow long caching. */
export function safeImageHeaders(contentType: string, filename: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': 'public, max-age=31536000, immutable'
  };
}

export class ImageStore {
  private readonly originalsDir: string;
  private readonly cacheDir: string;

  constructor(
    private readonly baseDir: string,
    private readonly processor: ImageProcessor = inProcessProcessor
  ) {
    this.originalsDir = path.join(baseDir, 'originals');
    this.cacheDir = path.join(baseDir, 'cache');
  }

  /** Create the storage directories if they don't exist. Safe to call repeatedly. */
  async init(): Promise<void> {
    await fs.mkdir(this.originalsDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Validate + store an uploaded image. Throws ImageValidationError on anything unsafe/unsupported.
   * @param buffer raw uploaded bytes
   * @param originalName client-supplied filename (used only for a display name; never for the path)
   * @param uploadedBy optional principal id for audit
   */
  async ingest(buffer: Buffer, originalName: string, uploadedBy?: string | null): Promise<ImageMeta> {
    if (!buffer || buffer.length === 0) {
      throw new ImageValidationError('Empty upload');
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new ImageValidationError(`File exceeds ${MAX_UPLOAD_BYTES} byte limit`);
    }

    const detected = detectImageType(buffer);
    if (detected === null) {
      throw new ImageValidationError('Unsupported or unrecognized image format');
    }

    await this.init();
    const id = randomUUID();
    const name = sanitizeDisplayName(originalName);
    const ext = EXT_BY_FORMAT[detected];

    let meta: ImageMeta;
    let bytesToStore: Buffer;

    if (detected === 'svg') {
      const sanitized = sanitizeSvg(buffer.toString('utf8'));
      if (!/<svg[\s>]/i.test(sanitized)) {
        throw new ImageValidationError('SVG could not be safely sanitized');
      }
      bytesToStore = Buffer.from(sanitized, 'utf8');
      const dims = readSvgDimensions(sanitized);
      meta = {
        id, name, format: 'svg', width: dims.width, height: dims.height,
        bytes: bytesToStore.length, animated: false, createdAt: new Date().toISOString(), uploadedBy: uploadedBy ?? null
      };
    } else {
      const probed = await probeRaster(buffer);
      bytesToStore = buffer;
      meta = {
        id, name, format: detected, width: probed.width, height: probed.height,
        bytes: bytesToStore.length, animated: probed.animated, createdAt: new Date().toISOString(), uploadedBy: uploadedBy ?? null
      };
    }

    await fs.writeFile(path.join(this.originalsDir, `${id}.${ext}`), bytesToStore);
    await fs.writeFile(path.join(this.originalsDir, `${id}.json`), JSON.stringify(meta, null, 2), 'utf8');
    return meta;
  }

  /** Read all stored image metadata (the shared library). */
  async list(): Promise<ImageMeta[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.originalsDir);
    } catch {
      return [];
    }
    const metas: ImageMeta[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.originalsDir, entry), 'utf8');
        metas.push(JSON.parse(raw) as ImageMeta);
      } catch {
        // Skip corrupt sidecar files.
      }
    }
    metas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return metas;
  }

  async getMeta(id: string): Promise<ImageMeta | null> {
    if (!isValidId(id)) return null;
    try {
      const raw = await fs.readFile(path.join(this.originalsDir, `${id}.json`), 'utf8');
      return JSON.parse(raw) as ImageMeta;
    } catch {
      return null;
    }
  }

  /** Path to the stored original (for the serving layer). */
  originalPath(meta: ImageMeta): string {
    return path.join(this.originalsDir, `${meta.id}.${EXT_BY_FORMAT[meta.format]}`);
  }

  /** Delete an image: original bytes, sidecar, and any cached variants. */
  async remove(id: string): Promise<boolean> {
    if (!isValidId(id)) return false;
    const meta = await this.getMeta(id);
    if (!meta) return false;
    await rmIfExists(this.originalPath(meta));
    await rmIfExists(path.join(this.originalsDir, `${id}.json`));
    await fs.rm(path.join(this.cacheDir, id), { recursive: true, force: true });
    return true;
  }

  /**
   * Produce a servable image: sanitized SVG as-is, or an on-demand WebP variant (resized to the
   * snapped width). Raster is ALWAYS re-encoded; the raw original raster is never returned. The
   * variant is cached on disk; concurrent requests for the same variant are coalesced.
   */
  async getServable(id: string, requestedWidth?: number | null): Promise<ServableImage | null> {
    const meta = await this.getMeta(id);
    if (!meta) return null;

    if (meta.format === 'svg') {
      const buffer = await fs.readFile(this.originalPath(meta));
      return { buffer, contentType: 'image/svg+xml', filename: `${id}.svg`, headers: safeImageHeaders('image/svg+xml', `${id}.svg`) };
    }

    const width = snapWidth(requestedWidth);
    const cachePath = path.join(this.cacheDir, id, `${width}.webp`);
    let buffer = await readIfExists(cachePath);
    if (!buffer) {
      const original = await fs.readFile(this.originalPath(meta));
      const result = await this.processor.process(
        { buffer: original, format: meta.format, width, animated: meta.animated },
        `${id}:${width}`
      );
      buffer = result.buffer;
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, buffer);
    }
    return { buffer, contentType: 'image/webp', filename: `${id}.webp`, headers: safeImageHeaders('image/webp', `${id}.webp`) };
  }

  /** Total bytes + file count of the generated-variant cache (for the settings UI). */
  async cacheStats(): Promise<{ bytes: number; files: number }> {
    let bytes = 0;
    let files = 0;
    const walk = async (dir: string): Promise<void> => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(p);
        } else {
          try {
            const stat = await fs.stat(p);
            bytes += stat.size;
            files += 1;
          } catch {
            // skip
          }
        }
      }
    };
    await walk(this.cacheDir);
    return { bytes, files };
  }

  /** Delete every generated variant. Originals + metadata are untouched (they regenerate on demand). */
  async purgeCache(): Promise<void> {
    await fs.rm(this.cacheDir, { recursive: true, force: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
  }
}

async function readIfExists(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id);
}

/** Reduce a client filename to a safe basename for display only (no path segments). */
function sanitizeDisplayName(name: string): string {
  const base = path.basename(String(name ?? '')).replace(/[ -]/g, '').trim();
  return base.length ? base.slice(0, 200) : 'image';
}

async function probeRaster(buffer: Buffer): Promise<{ width: number | null; height: number | null; animated: boolean; format: ImageFormat }> {
  const metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: true })
    .metadata()
    .catch((e: unknown) => {
      throw new ImageValidationError(`Image could not be decoded: ${(e as Error).message}`);
    });
  const fmt = metadata.format ? SHARP_FORMAT_MAP[metadata.format] : undefined;
  if (!fmt || !RASTER_FORMATS.includes(fmt)) {
    throw new ImageValidationError(`Unsupported raster format: ${String(metadata.format)}`);
  }
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  const pages = metadata.pages ?? 1;
  if (width && height && width * height * pages > MAX_INPUT_PIXELS) {
    throw new ImageValidationError('Image exceeds the maximum pixel budget');
  }
  return { width, height, animated: pages > 1, format: fmt };
}

function readSvgDimensions(svg: string): { width: number | null; height: number | null } {
  const w = /\bwidth\s*=\s*["']?\s*([\d.]+)/i.exec(svg);
  const h = /\bheight\s*=\s*["']?\s*([\d.]+)/i.exec(svg);
  const width = w ? Number(w[1]) : null;
  const height = h ? Number(h[1]) : null;
  return {
    width: Number.isFinite(width as number) ? width : null,
    height: Number.isFinite(height as number) ? height : null
  };
}

async function rmIfExists(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch {
    // ignore missing
  }
}
