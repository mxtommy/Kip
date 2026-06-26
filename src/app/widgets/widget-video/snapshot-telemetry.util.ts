import type { ISnapshotTelemetry } from './snapshot-exif.util';

/** Minimal shape read from DataService.getPathObject(): the current value of a Signal K path. */
export interface IPathValue {
  pathValue: unknown;
}

/** Reads the current cached value object for a Signal K path (e.g. DataService.getPathObject). */
export type PathGetter = (path: string) => IPathValue | null;

export const MS_TO_KNOTS = 1.9438444924406;
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Gathers snapshot telemetry from the live Signal K data cache, converting from SI units
 * (m/s, radians, kelvin) to the canonical units used in EXIF (knots, degrees, °C). Missing paths
 * are simply omitted. Heading prefers true over magnetic and reports which was used.
 *
 * @param getPath a current-value getter (e.g. `p => dataService.getPathObject(p)`)
 * @param now     capture time
 */
const normalizeDeg = (d: number): number => ((d % 360) + 360) % 360;
const round = (v: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

export function gatherSnapshotTelemetry(getPath: PathGetter, now: Date): ISnapshotTelemetry {
  const num = (path: string): number | undefined => {
    const v = getPath(path)?.pathValue;
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };

  const t: ISnapshotTelemetry = { timestamp: now };

  const pos = getPath('self.navigation.position')?.pathValue as
    { latitude?: number; longitude?: number; altitude?: number } | undefined;
  if (pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
    t.latitude = pos.latitude;
    t.longitude = pos.longitude;
    if (typeof pos.altitude === 'number') {
      t.altitude = pos.altitude;
    }
  }

  const sog = num('self.navigation.speedOverGround');
  if (sog != null) {
    t.sogKnots = sog * MS_TO_KNOTS;
  }

  const cog = num('self.navigation.courseOverGroundTrue');
  if (cog != null) {
    t.cogDeg = normalizeDeg(cog * RAD_TO_DEG);
  }

  const headingTrue = num('self.navigation.headingTrue');
  const headingMagnetic = num('self.navigation.headingMagnetic');
  if (headingTrue != null) {
    t.headingDeg = normalizeDeg(headingTrue * RAD_TO_DEG);
    t.headingRef = 'T';
  } else if (headingMagnetic != null) {
    t.headingDeg = normalizeDeg(headingMagnetic * RAD_TO_DEG);
    t.headingRef = 'M';
  }

  const name = getPath('self.name')?.pathValue;
  if (typeof name === 'string' && name.trim()) {
    t.vesselName = name.trim();
  }

  const extra: Record<string, number> = {};
  const depth = num('self.environment.depth.belowTransducer');
  if (depth != null) extra['depthMeters'] = round(depth, 2);
  const wind = num('self.environment.wind.speedApparent');
  if (wind != null) extra['windSpeedKnots'] = round(wind * MS_TO_KNOTS, 1);
  const waterTemp = num('self.environment.water.temperature');
  if (waterTemp != null) extra['waterTempCelsius'] = round(waterTemp - 273.15, 1);
  const stw = num('self.navigation.speedThroughWater');
  if (stw != null) extra['stwKnots'] = round(stw * MS_TO_KNOTS, 1);
  if (Object.keys(extra).length) {
    t.extra = extra;
  }

  return t;
}
