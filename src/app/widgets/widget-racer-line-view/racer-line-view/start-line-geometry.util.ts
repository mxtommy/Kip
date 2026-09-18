/**
 * Geometry behind the start line drawing, matching the visualization in the
 * signalk-racer webapp.
 *
 * The line is drawn "line up": always horizontal, with the port (pin) end to the left
 * and the starboard (committee boat) end to the right. The course side of the line is
 * therefore always the upper half of the drawing and the pre-start side the lower half,
 * so the heading sailed to cross the line always points straight up the screen.
 */

/** A geographic position, as the plugin publishes the two line ends. */
export interface ILatLon { latitude: number; longitude: number }

/** The line resolved into the coordinate system the drawing uses. */
export interface ILineGeometry {
  /** Length of the line in metres, from the two ends. */
  length: number;
  /** Bearing of the line in degrees, starboard end -> port end. */
  bearing: number;
  /**
   * The boat, when its position is known:
   *  a = distance along the line from the starboard (boat) end towards the port (pin) end
   *  c = distance across the line, positive on the pre-start side (negative is OCS)
   */
  boat: { a: number; c: number } | null;
}

const EARTH_RADIUS = 6371000;

/**
 * Offset of a point from an origin, in metres east/north. Equirectangular is exact
 * enough here: a start line is a few hundred metres.
 */
export function offsetFrom(origin: ILatLon, point: ILatLon): { e: number; n: number } {
  const lat0 = origin.latitude * Math.PI / 180;
  return {
    e: (point.longitude - origin.longitude) * Math.PI / 180 * Math.cos(lat0) * EARTH_RADIUS,
    n: (point.latitude - origin.latitude) * Math.PI / 180 * EARTH_RADIUS
  };
}

/**
 * Resolve the line and the boat into the drawing's along/across coordinates.
 *
 * @param port The port (pin) end of the line.
 * @param stb The starboard (committee boat) end of the line.
 * @param position The vessel's position, or null when it is not known.
 * @returns The geometry, or null when the two ends do not describe a line.
 */
export function lineGeometry(
  port: ILatLon | null,
  stb: ILatLon | null,
  position: ILatLon | null
): ILineGeometry | null {
  if (!port || !stb) return null;

  const v = offsetFrom(stb, port);
  const length = Math.hypot(v.e, v.n);
  if (!(length > 0)) return null;

  // Unit vector along the line, starboard end -> port end.
  const u = { e: v.e / length, n: v.n / length };
  // The pre-start side lies 90 degrees anticlockwise of the line bearing.
  const across = { e: -u.n, n: u.e };
  const bearing = (Math.atan2(u.e, u.n) * 180 / Math.PI + 360) % 360;

  let boat: ILineGeometry['boat'] = null;
  if (position) {
    const p = offsetFrom(stb, position);
    boat = { a: p.e * u.e + p.n * u.n, c: p.e * across.e + p.n * across.n };
  }

  return { length, bearing, boat };
}

/**
 * Map a compass bearing onto the screen, given the line's own bearing. Screen x runs
 * right and screen y runs down, so the course side (90 degrees clockwise of the line
 * bearing) comes out as straight up.
 *
 * @param bearing The compass bearing to map, in radians.
 * @param lineBearing The line's bearing (starboard end -> port end), in degrees.
 */
export function screenVector(bearing: number, lineBearing: number): { x: number; y: number } {
  const t = bearing - lineBearing * Math.PI / 180;
  return { x: -Math.cos(t), y: -Math.sin(t) };
}
