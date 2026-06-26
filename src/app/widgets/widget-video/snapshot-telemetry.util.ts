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
export function gatherSnapshotTelemetry(getPath: PathGetter, now: Date): ISnapshotTelemetry {
  void getPath;
  void now;
  // RED stub.
  return {};
}
