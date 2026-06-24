import sharp from 'sharp';
import convert from 'heic-convert';
import type { ImageFormat } from './image-store';

/**
 * Pure image-processing logic shared by the in-process processor and the worker-thread script.
 * Converts/resizes a validated original to WebP, preserving animation (GIF/WebP) and decoding
 * HEIC/HEIF via the portable pure-JS heic-convert (so we don't depend on libheif in the sharp build).
 */

const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 80;

/** Allowed output widths. Requests are snapped to one of these to bound the on-disk cache. */
export const WIDTH_ALLOWLIST: readonly number[] = [160, 320, 640, 960, 1280, 1920, 2560];
export const CANONICAL_WIDTH = WIDTH_ALLOWLIST[WIDTH_ALLOWLIST.length - 1];

/** Snap a requested width up to the nearest allow-listed width (canonical when unset/invalid). */
export function snapWidth(requested?: number | null): number {
  if (!requested || !Number.isFinite(requested) || requested <= 0) return CANONICAL_WIDTH;
  for (const w of WIDTH_ALLOWLIST) {
    if (w >= requested) return w;
  }
  return CANONICAL_WIDTH;
}

/** Worker pool size: n-1 CPUs to keep the server responsive, clamped to at least 1. */
export function computeWorkerCount(cpuCount: number): number {
  return Math.max(1, (Number.isFinite(cpuCount) ? cpuCount : 1) - 1);
}

export interface ProcessRequest {
  buffer: Buffer;
  format: ImageFormat;     // detected source format (never 'svg' here)
  width: number;           // already snapped to the allow-list
  animated: boolean;
}

export interface ProcessResult {
  buffer: Buffer;          // WebP bytes
  width: number;
  height: number;
}

export interface ImageProcessor {
  process(req: ProcessRequest, coalesceKey?: string): Promise<ProcessResult>;
}

/** Convert + resize a raster original to a WebP variant. */
export async function processImage(req: ProcessRequest): Promise<ProcessResult> {
  let input = req.buffer;

  if (req.format === 'heic') {
    // Decode HEIC/HEIF to JPEG first (pure JS), then hand to sharp.
    const decoded = await convert({ buffer: input as unknown as ArrayBufferLike, format: 'JPEG', quality: 0.92 });
    input = Buffer.from(decoded);
  }

  let pipe = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: req.animated });
  if (!req.animated) {
    pipe = pipe.rotate(); // auto-orient static images from EXIF
  }
  pipe = pipe
    .resize({ width: req.width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 });

  const { data, info } = await pipe.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: info.width,
    height: (info as { pageHeight?: number }).pageHeight ?? info.height
  };
}

/** A processor that runs jobs inline (used in tests and as a no-worker fallback). */
export const inProcessProcessor: ImageProcessor = {
  process: (req) => processImage(req)
};
