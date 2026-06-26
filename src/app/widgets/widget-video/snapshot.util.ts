import { buildSnapshotExif } from './snapshot-exif.util';
import { gatherSnapshotTelemetry, type PathGetter } from './snapshot-telemetry.util';
import { dataUrlToBlob, embedExifInJpegDataUrl } from './snapshot-image.util';

export interface IComposeSnapshotOptions {
  /** Capture time. */
  now: Date;
  /** Master switch: embed any telemetry at all. */
  embedTelemetry: boolean;
  /** Embed GPS position + derived GPS fields (the location-privacy switch). */
  embedLocation: boolean;
  /** Camera name → EXIF Model and the filename label. */
  cameraName?: string | null;
}

export interface ISnapshotResult {
  blob: Blob;
  filename: string;
  /** The EXIF-embedded JPEG data URL (also useful for preview/share). */
  dataUrl: string;
}

/** Builds a safe snapshot filename like `foredeck-cam-2026-06-26T04-30-15Z.jpg`. */
export function buildSnapshotFilename(now: Date, label?: string | null): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}Z`;
  const slug = (label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'snapshot'}-${stamp}.jpg`;
}

/**
 * Composes a final snapshot from a captured JPEG data URL: gathers telemetry, builds and embeds the
 * EXIF (honouring the telemetry/location switches), and returns a Blob + filename ready for the
 * chosen destination. Pure except for Blob/atob; the actual frame capture is done by the caller.
 */
export function composeSnapshot(jpegDataUrl: string, getPath: PathGetter, opts: IComposeSnapshotOptions): ISnapshotResult {
  const gathered = gatherSnapshotTelemetry(getPath, opts.now);
  const telemetry = opts.embedTelemetry ? gathered : { timestamp: gathered.timestamp };
  const exif = buildSnapshotExif(telemetry, {
    includeGps: opts.embedTelemetry && opts.embedLocation,
    cameraName: opts.cameraName
  });
  const dataUrl = embedExifInJpegDataUrl(jpegDataUrl, exif);
  return {
    blob: dataUrlToBlob(dataUrl),
    filename: buildSnapshotFilename(opts.now, opts.cameraName),
    dataUrl
  };
}
