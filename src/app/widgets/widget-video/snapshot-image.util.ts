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
