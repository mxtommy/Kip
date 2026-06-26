import piexif from 'piexifjs';

/** Telemetry captured at snapshot time, to embed in the image EXIF. */
export interface ISnapshotTelemetry {
  /** Latitude in decimal degrees (WGS-84). */
  latitude?: number | null;
  /** Longitude in decimal degrees (WGS-84). */
  longitude?: number | null;
  /** Altitude in metres above sea level. */
  altitude?: number | null;
  /** Speed over ground, knots. */
  sogKnots?: number | null;
  /** Course over ground, degrees. */
  cogDeg?: number | null;
  /** Heading, degrees. */
  headingDeg?: number | null;
  /** Reference for heading: true or magnetic. */
  headingRef?: 'T' | 'M';
  /** Capture time; UTC fields are used for the GPS timestamps. */
  timestamp?: Date;
  /** Vessel name. */
  vesselName?: string | null;
  /** Free-form extra telemetry (depth, wind, water temp, STW …) → EXIF UserComment. */
  extra?: Record<string, string | number | null | undefined>;
}

export interface IBuildExifOptions {
  /** Embed GPS position/derived fields. Default true. */
  includeGps?: boolean;
  /** Camera name → EXIF Model. */
  cameraName?: string | null;
}

/** piexif EXIF dictionary shape: IFD name → (tag number → value). */
export type ExifDict = Record<string, Record<number, unknown>>;

/**
 * Converts a decimal degree value to an EXIF GPS DMS rational triplet:
 * [[deg,1],[min,1],[sec*100,100]] using the absolute value (the hemisphere ref is separate).
 */
export function decimalToDmsRational(decimal: number): [number, number][] {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return [[deg, 1], [min, 1], [Math.round(sec * 100), 100]];
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const rational100 = (v: number): [number, number] => [Math.round(v * 100), 100];
const utcDate = (d: Date): string => `${d.getUTCFullYear()}:${pad2(d.getUTCMonth() + 1)}:${pad2(d.getUTCDate())}`;
const utcDateTime = (d: Date): string => `${utcDate(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;

/**
 * Builds a piexif-shaped EXIF dictionary from snapshot telemetry, ready for piexif.dump()/insert().
 * GPS fields are only included when a position is present and options.includeGps !== false.
 */
export function buildSnapshotExif(telemetry: ISnapshotTelemetry, options: IBuildExifOptions = {}): ExifDict {
  const G = piexif.GPSIFD;
  const I = piexif.ImageIFD;
  const E = piexif.ExifIFD;
  const includeGps = options.includeGps !== false;
  const hasPosition = telemetry.latitude != null && telemetry.longitude != null;

  const zeroth: Record<number, unknown> = {};
  const exif: Record<number, unknown> = {};
  const gps: Record<number, unknown> = {};

  zeroth[I.Make] = 'KIP';
  if (options.cameraName) {
    zeroth[I.Model] = options.cameraName;
  }

  const ts = telemetry.timestamp;
  if (ts) {
    const dt = utcDateTime(ts);
    exif[E.DateTimeOriginal] = dt;
    zeroth[I.DateTime] = dt;
  }

  const descParts: string[] = [];
  if (telemetry.vesselName) {
    descParts.push(telemetry.vesselName);
  }
  if (includeGps && hasPosition) {
    descParts.push(`${telemetry.latitude!.toFixed(5)}, ${telemetry.longitude!.toFixed(5)}`);
  }
  if (descParts.length) {
    zeroth[I.ImageDescription] = descParts.join(' — ');
  }

  const comment: Record<string, string | number> = {};
  if (telemetry.vesselName) comment['vessel'] = telemetry.vesselName;
  if (telemetry.sogKnots != null) comment['sogKnots'] = telemetry.sogKnots;
  if (telemetry.cogDeg != null) comment['cogDeg'] = telemetry.cogDeg;
  if (telemetry.headingDeg != null) comment['headingDeg'] = telemetry.headingDeg;
  for (const [k, v] of Object.entries(telemetry.extra ?? {})) {
    if (v != null) comment[k] = v;
  }
  if (Object.keys(comment).length) {
    // EXIF UserComment requires an 8-byte character-code prefix.
    exif[E.UserComment] = `ASCII\0\0\0${JSON.stringify(comment)}`;
  }

  if (includeGps && hasPosition) {
    const lat = telemetry.latitude!;
    const lon = telemetry.longitude!;
    gps[G.GPSVersionID] = [2, 3, 0, 0];
    gps[G.GPSMapDatum] = 'WGS-84';
    gps[G.GPSLatitude] = decimalToDmsRational(lat);
    gps[G.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
    gps[G.GPSLongitude] = decimalToDmsRational(lon);
    gps[G.GPSLongitudeRef] = lon >= 0 ? 'E' : 'W';

    if (telemetry.altitude != null) {
      gps[G.GPSAltitude] = rational100(Math.abs(telemetry.altitude));
      gps[G.GPSAltitudeRef] = telemetry.altitude < 0 ? 1 : 0;
    }
    if (telemetry.sogKnots != null) {
      gps[G.GPSSpeed] = rational100(telemetry.sogKnots);
      gps[G.GPSSpeedRef] = 'N'; // knots
    }
    if (telemetry.cogDeg != null) {
      gps[G.GPSTrack] = rational100(telemetry.cogDeg);
      gps[G.GPSTrackRef] = 'T';
    }
    if (telemetry.headingDeg != null) {
      gps[G.GPSImgDirection] = rational100(telemetry.headingDeg);
      gps[G.GPSImgDirectionRef] = telemetry.headingRef ?? 'T';
    }
    if (ts) {
      gps[G.GPSDateStamp] = utcDate(ts);
      gps[G.GPSTimeStamp] = [[ts.getUTCHours(), 1], [ts.getUTCMinutes(), 1], [ts.getUTCSeconds(), 1]];
    }
  }

  return { '0th': zeroth, Exif: exif, GPS: gps };
}
