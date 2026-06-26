import { describe, it, expect } from 'vitest';
import piexif from 'piexifjs';
import { embedExifInJpegDataUrl, dataUrlToBlob } from './snapshot-image.util';
import { buildSnapshotExif } from './snapshot-exif.util';

// A minimal valid 1x1 JPEG (no EXIF) used as the canvas-output stand-in.
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==';

const NOW = new Date(Date.UTC(2026, 5, 26, 4, 30, 15));

describe('embedExifInJpegDataUrl', () => {
  it('returns a JPEG data URL with the GPS EXIF readable back', () => {
    const exif = buildSnapshotExif({ latitude: 48.8584, longitude: -2.2945, sogKnots: 6.4, timestamp: NOW });
    const out = embedExifInJpegDataUrl(TINY_JPEG, exif);

    expect(out.startsWith('data:image/jpeg')).toBe(true);
    expect(out).not.toBe(TINY_JPEG); // EXIF was actually inserted

    const loaded = piexif.load(out);
    expect(loaded.GPS[piexif.GPSIFD.GPSLatitudeRef]).toBe('N');
    expect(loaded.GPS[piexif.GPSIFD.GPSLongitudeRef]).toBe('W');
    expect(loaded.GPS[piexif.GPSIFD.GPSSpeedRef]).toBe('N');
    expect(loaded.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe('2026:06:26 04:30:15');
  });
});

describe('dataUrlToBlob', () => {
  it('produces a Blob of the declared mime type with bytes', () => {
    const blob = dataUrlToBlob(TINY_JPEG);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBeGreaterThan(100);
  });
});
