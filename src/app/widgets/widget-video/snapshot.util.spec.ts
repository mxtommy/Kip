import { describe, it, expect } from 'vitest';
import piexif from 'piexifjs';
import { buildSnapshotFilename, composeSnapshot } from './snapshot.util';
import type { IPathValue } from './snapshot-telemetry.util';

const NOW = new Date(Date.UTC(2026, 5, 26, 4, 30, 15));
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==';

function getter(values: Record<string, unknown>) {
  return (path: string): IPathValue | null => (path in values ? { pathValue: values[path] } : null);
}
const SELF = getter({
  'self.navigation.position': { latitude: 48.8584, longitude: -2.2945 },
  'self.navigation.speedOverGround': 3.2922
});

describe('buildSnapshotFilename', () => {
  it('uses a default label and a filesystem-safe UTC timestamp', () => {
    expect(buildSnapshotFilename(NOW)).toBe('snapshot-2026-06-26T04-30-15Z.jpg');
  });
  it('slugs a camera label into the filename', () => {
    expect(buildSnapshotFilename(NOW, 'Foredeck Cam')).toBe('foredeck-cam-2026-06-26T04-30-15Z.jpg');
  });
});

describe('composeSnapshot', () => {
  const base = { now: NOW, embedTelemetry: true, embedLocation: true };

  it('returns a JPEG blob + filename and embeds GPS when both switches are on', () => {
    const r = composeSnapshot(TINY_JPEG, SELF, { ...base, cameraName: 'Foredeck Cam' });
    expect(r.blob.type).toBe('image/jpeg');
    expect(r.blob.size).toBeGreaterThan(100);
    expect(r.filename).toBe('foredeck-cam-2026-06-26T04-30-15Z.jpg');
    const gps = piexif.load(r.dataUrl).GPS;
    expect(gps[piexif.GPSIFD.GPSLatitudeRef]).toBe('N');
    expect(gps[piexif.GPSIFD.GPSSpeedRef]).toBe('N');
  });

  it('omits GPS but keeps the timestamp when location is off', () => {
    const r = composeSnapshot(TINY_JPEG, SELF, { ...base, embedLocation: false });
    const loaded = piexif.load(r.dataUrl);
    expect(loaded.GPS[piexif.GPSIFD.GPSLatitude]).toBeUndefined();
    expect(loaded.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe('2026:06:26 04:30:15');
  });

  it('embeds no telemetry at all when the master switch is off', () => {
    const r = composeSnapshot(TINY_JPEG, SELF, { ...base, embedTelemetry: false });
    const loaded = piexif.load(r.dataUrl);
    expect(loaded.GPS[piexif.GPSIFD.GPSLatitude]).toBeUndefined();
    expect(loaded.Exif[piexif.ExifIFD.UserComment]).toBeUndefined();
    expect(loaded.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe('2026:06:26 04:30:15');
  });
});
