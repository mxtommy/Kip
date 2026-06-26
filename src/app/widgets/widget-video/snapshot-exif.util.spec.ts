import { describe, it, expect } from 'vitest';
import piexif from 'piexifjs';
import { buildSnapshotExif, decimalToDmsRational, type ISnapshotTelemetry } from './snapshot-exif.util';

const G = piexif.GPSIFD;
const I = piexif.ImageIFD;
const E = piexif.ExifIFD;

const FULL: ISnapshotTelemetry = {
  latitude: 48.8584,
  longitude: -2.2945,
  altitude: 12,
  sogKnots: 6.4,
  cogDeg: 215.5,
  headingDeg: 210,
  headingRef: 'M',
  timestamp: new Date(Date.UTC(2026, 5, 26, 4, 30, 15)), // 2026-06-26 04:30:15 UTC
  vesselName: 'Test Vessel',
  extra: { depthMeters: 3.2, windSpeedKnots: 14 }
};

describe('decimalToDmsRational', () => {
  it('converts decimal degrees to a d/m/s rational triplet (abs value)', () => {
    expect(decimalToDmsRational(48.8584)).toEqual([[48, 1], [51, 1], [3024, 100]]);
  });

  it('uses the absolute value (sign is carried by the hemisphere ref, not here)', () => {
    expect(decimalToDmsRational(-2.2945)).toEqual(decimalToDmsRational(2.2945));
  });
});

describe('buildSnapshotExif', () => {
  it('maps a full position to the GPS IFD with correct hemisphere refs and datum', () => {
    const gps = buildSnapshotExif(FULL).GPS;
    expect(gps[G.GPSLatitude]).toEqual([[48, 1], [51, 1], [3024, 100]]);
    expect(gps[G.GPSLatitudeRef]).toBe('N');
    expect(gps[G.GPSLongitudeRef]).toBe('W');
    expect(gps[G.GPSMapDatum]).toBe('WGS-84');
  });

  it('maps SOG to GPSSpeed in knots, COG to GPSTrack, heading to GPSImgDirection', () => {
    const gps = buildSnapshotExif(FULL).GPS;
    expect(gps[G.GPSSpeedRef]).toBe('N'); // N = knots
    expect(gps[G.GPSSpeed]).toEqual([640, 100]);
    expect(gps[G.GPSTrackRef]).toBe('T');
    expect(gps[G.GPSTrack]).toEqual([21550, 100]);
    expect(gps[G.GPSImgDirection]).toEqual([21000, 100]);
    expect(gps[G.GPSImgDirectionRef]).toBe('M');
  });

  it('writes UTC GPS date and time stamps', () => {
    const gps = buildSnapshotExif(FULL).GPS;
    expect(gps[G.GPSDateStamp]).toBe('2026:06:26');
    expect(gps[G.GPSTimeStamp]).toEqual([[4, 1], [30, 1], [15, 1]]);
  });

  it('sets identifying 0th tags and a DateTimeOriginal', () => {
    const exif = buildSnapshotExif(FULL, { cameraName: 'Foredeck Cam' });
    expect(exif['0th'][I.Make]).toBe('KIP');
    expect(exif['0th'][I.Model]).toBe('Foredeck Cam');
    expect(exif.Exif[E.DateTimeOriginal]).toBe('2026:06:26 04:30:15');
  });

  it('embeds extra telemetry + vessel name in UserComment', () => {
    const comment = String(buildSnapshotExif(FULL).Exif[E.UserComment] ?? '');
    expect(comment).toContain('Test Vessel');
    expect(comment).toContain('depthMeters');
    expect(comment).toContain('14');
  });

  it('omits GPS when no position is available, but still records the time', () => {
    const exif = buildSnapshotExif({ timestamp: FULL.timestamp });
    expect(exif.GPS[G.GPSLatitude]).toBeUndefined();
    expect(exif.GPS[G.GPSLongitude]).toBeUndefined();
    expect(exif.Exif[E.DateTimeOriginal]).toBe('2026:06:26 04:30:15');
  });

  it('omits GPS entirely when includeGps is false even with a position', () => {
    const gps = buildSnapshotExif(FULL, { includeGps: false }).GPS;
    expect(gps[G.GPSLatitude]).toBeUndefined();
    expect(gps[G.GPSSpeed]).toBeUndefined();
  });
});
