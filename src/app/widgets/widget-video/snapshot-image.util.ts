import piexif from 'piexifjs';
import type { ExifDict } from './snapshot-exif.util';

/**
 * Inserts an EXIF dictionary into a JPEG data URL (as produced by `canvas.toDataURL('image/jpeg')`)
 * and returns the new JPEG data URL. The input must be a JPEG; PNG/WebP cannot carry EXIF.
 */
export function embedExifInJpegDataUrl(jpegDataUrl: string, exif: ExifDict): string {
  void jpegDataUrl;
  void exif;
  void piexif;
  // RED stub.
  return '';
}

/** Converts a base64 data URL to a Blob (for download / Web Share / upload). */
export function dataUrlToBlob(dataUrl: string): Blob {
  void dataUrl;
  // RED stub.
  return new Blob();
}
