/** A pan/tilt/zoom velocity vector, each component in [-1, 1]. */
export interface IPtzVector {
  /** Positive pans right. */
  pan: number;
  /** Positive tilts up. */
  tilt: number;
  /** Positive zooms in. */
  zoom: number;
}

/** Proxy sub-paths on the sk-video plugin for each PTZ action (relative to `cameras/:id/`). */
export type TPtzPath = 'ptz' | 'ptz/stop' | 'ptz/presets' | 'ptz/preset';

/** Camera ids become part of a URL path, so they must be a plain safe slug. */
const CAMERA_ID = /^[A-Za-z0-9-]+$/;

/** Clamps a velocity to the [-1, 1] range the gateway accepts; non-finite input becomes 0. */
export function clampUnit(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

/** Clamps every component of a partial PTZ vector into range. */
export function clampPtzVector(v: { pan?: number; tilt?: number; zoom?: number }): IPtzVector {
  return { pan: clampUnit(v.pan), tilt: clampUnit(v.tilt), zoom: clampUnit(v.zoom) };
}

/**
 * Turns a drag offset (pixels from the press point) into a PTZ velocity, like a virtual joystick:
 * dragging right pans right and dragging up tilts up. `reference` is the drag distance, in pixels,
 * that maps to full speed; beyond it the velocity clamps to ±1.
 */
export function dragToPtzVector(dx: number, dy: number, reference = 120): IPtzVector {
  const ref = Number.isFinite(reference) && reference > 0 ? reference : 1;
  // Normalise -0 to 0 so a purely horizontal/vertical drag has a clean zero on the other axis.
  const z = (n: number): number => (n === 0 ? 0 : n);
  return { pan: z(clampUnit(dx / ref)), tilt: z(clampUnit(-dy / ref)), zoom: 0 };
}

/**
 * Builds the same-origin PTZ endpoint URL for a saved camera, or `null` when the inputs are missing
 * or unsafe. `baseUrl` must be the resolved sk-video plugin base (`http(s)`, ending in `/`).
 */
export function buildPtzUrl(
  baseUrl: string | null | undefined,
  cameraId: string | null | undefined,
  path: TPtzPath
): string | null {
  if (!baseUrl || !cameraId || !CAMERA_ID.test(cameraId)) {
    return null;
  }
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return null;
  }
  const dir = base.href.endsWith('/') ? base.href : `${base.href}/`;
  return new URL(`cameras/${cameraId}/${path}`, dir).href;
}
