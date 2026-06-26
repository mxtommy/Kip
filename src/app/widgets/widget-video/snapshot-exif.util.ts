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
  void decimal;
  // RED stub.
  return [[0, 1], [0, 1], [0, 1]];
}

/**
 * Builds a piexif-shaped EXIF dictionary from snapshot telemetry, ready for piexif.dump()/insert().
 * GPS fields are only included when a position is present and options.includeGps !== false.
 */
export function buildSnapshotExif(telemetry: ISnapshotTelemetry, options?: IBuildExifOptions): ExifDict {
  void telemetry;
  void options;
  void piexif;
  // RED stub.
  return { '0th': {}, Exif: {}, GPS: {} };
}
