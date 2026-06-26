import piexif from 'piexifjs';
import type { ExifDict } from './snapshot-exif.util';

/**
 * Inserts an EXIF dictionary into a JPEG data URL (as produced by `canvas.toDataURL('image/jpeg')`)
 * and returns the new JPEG data URL. The input must be a JPEG; PNG/WebP cannot carry EXIF.
 */
export function embedExifInJpegDataUrl(jpegDataUrl: string, exif: ExifDict): string {
  const exifBytes = piexif.dump(exif as unknown as piexif.ExifDict);
  return piexif.insert(exifBytes, jpegDataUrl);
}

/**
 * Captures the current video frame as a JPEG data URL via a canvas. Throws a SecurityError if the
 * canvas is tainted (a cross-origin source served without CORS) — callers should catch and surface
 * a clear "snapshot not available for this source" message.
 */
export function captureVideoFrameJpegDataUrl(video: HTMLVideoElement, quality = 0.92): string {
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable');
  }
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Triggers a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether the browser can share an image file via the Web Share API. */
export function canShareSnapshot(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare({ files: [new File([new Blob()], 'snapshot.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}

/** Shares a snapshot Blob as a JPEG file via the Web Share API. */
export async function shareSnapshot(blob: Blob, filename: string, title = 'Snapshot'): Promise<void> {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  await navigator.share({ files: [file], title });
}

/** Converts a base64 data URL to a Blob (for download / Web Share / upload). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mime = /data:(.*?)(?:;base64)?$/.exec(header)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
