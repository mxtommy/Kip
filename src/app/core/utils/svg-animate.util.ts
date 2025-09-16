import type { NgZone } from '@angular/core';

/**
 * SVG Animation Utilities
 * -------------------------------------------------------------
 * Helpers for lightweight, allocation‑minimal animations using requestAnimationFrame.
 * All mutative work (DOM attribute updates) can run outside Angular's zone to avoid
 * triggering change detection on every frame. Pass an NgZone instance as the final
 * argument (where supported) to opt into outside‑zone execution; omit for pure / non‑Angular usage.
 *
 * Available helpers:
 *  - animateRotation: Smoothly rotate a <g> element (or any element) via transform rotate().
 *  - animateRudderWidth: Smoothly animate an <rect> width attribute.
 *  - animateAngleTransition: Interpolate a scalar angle value (degrees) with wrap handling.
 *  - animateSectorTransition: Interpolate a set of three angles (min/mid/max) simultaneously.
 *
 * Cancellation patterns:
 *  - All functions return (or internally store) a requestAnimationFrame id. Use cancelAnimationFrame(id) to stop early.
 *  - For animateRotation / animateRudderWidth you may supply a WeakMap<Element, number> (frameMap); if a new
 *    animation starts for the same element, the previous id is auto‑cancelled.
 *  - For custom callers of animateAngleTransition / animateSectorTransition keep and cancel the returned id manually.
 *
 * Performance notes:
 *  - Easing function is cubic in/out to match existing widget feel.
 *  - Angle interpolation normalizes shortest path (avoids >180° spins) where relevant.
 *  - No setTimeout fallbacks; if you need reduced frame rate sampling, throttle at the call site.
 *
 * Memory / GC:
 *  - WeakMap avoids leaks for element‑bound animations; entries are removed when animations finish.
 *
 * Example (rotation outside zone with tracking & completion):
 *  const ngZone = inject(NgZone);
 *  const frames = new WeakMap<SVGGElement, number>();
 *  animateRotation(el, oldAngle, newAngle, 900, () => console.log('done'), frames, undefined, ngZone);
 */

/**
 * Smoothly animates the rotation of an SVG <g> element from a starting angle to a target angle.
 *
 * The function uses requestAnimationFrame for smooth animation and cubic easing for a natural feel.
 * It can optionally manage and cancel overlapping animations for the same element using a WeakMap.
 *
 * @param element    The SVG <g> (or other) element to rotate.
 * @param from       The starting angle in degrees.
 * @param to         The target angle in degrees.
 * @param duration   Animation duration in milliseconds (default: 1000).
 * @param onDone     Optional callback to run when the animation completes.
 * @param frameMap   Optional WeakMap<element, frameId> to auto-cancel previous animation on same element.
 * @param center     Optional [cx, cy] array for the rotation center (default: [500, 500]).
 * @param ngZone     Optional Angular NgZone. If provided, frames run outside Angular's zone to avoid per-frame
 *                   change detection; onDone (if any) is re-entered inside the zone. Omit for non-Angular usage.
 *
 * @example
 * // 1. In your component, create a WeakMap to track animation frames:
 * private animationFrameIds = new WeakMap<SVGGElement, number>();
 *
 * // 2. In your SVG template, assign a template reference variable to your <g> element:
 * <g #rotatingDial> ... </g>
 *
 * // 3. In your component, get a reference to the element using viewChild:
 * private readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
 *
 * // 4. Use the utility to animate rotation (with custom center):
 * import { animateRotation } from 'src/app/core/utils/svg-animate.util';
 *
 * // (A) Minimal (no tracking, no NgZone):
 * animateRotation(el, oldAngle, newAngle);
 *
 * // (B) With WeakMap frame tracking & custom center:
 * animateRotation(el, oldAngle, newAngle, 800, undefined, animationFrameIds, [400, 400]);
 *
 * // (C) Running rAF outside Angular zone (recommended in components):
 * const ngZone = inject(NgZone);
 * animateRotation(el, oldAngle, newAngle, 800, () => console.log('done'), animationFrameIds, [500, 500], ngZone);
 *
 * // (D) Cancel manually at any time:
 * const id = animationFrameIds.get(el); if (id) cancelAnimationFrame(id);
 */
export function animateRotation(
  element: SVGGElement,
  from: number,
  to: number,
  duration = 1000,
  onDone?: () => void,
  frameMap?: WeakMap<SVGGElement, number>,
  center: [number, number] = [500, 500],
  ngZone?: NgZone
) {
  if (frameMap) {
    const prevId = frameMap.get(element);
    if (prevId) cancelAnimationFrame(prevId);
  }

  // Read current angle from element if possible
  const getCurrentAngle = () => {
    const transform = element.getAttribute('transform');
    if (transform) {
      const match = /rotate\((-?\d+(\.\d+)?)/.exec(transform);
      if (match) return parseFloat(match[1]);
    }
    return from;
  };

  from = getCurrentAngle();

  const normalize = (angle: number) => (angle + 360) % 360;
  from = normalize(from);
  to = normalize(to);

  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const runOutside = (fn: () => void) => ngZone ? ngZone.runOutsideAngular(fn) : fn();
  const runInside = (fn: () => void) => ngZone ? ngZone.run(fn) : fn();

  runOutside(() => {
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      const current = from + delta * eased;
      element.setAttribute('transform', `rotate(${current} ${center[0]} ${center[1]})`);
      if (progress < 1) {
        const id = requestAnimationFrame(animate);
        if (frameMap) frameMap.set(element, id);
      } else {
        element.setAttribute('transform', `rotate(${to} ${center[0]} ${center[1]})`);
        if (onDone) runInside(onDone);
        if (frameMap) frameMap.delete(element);
      }
    };
    const id = requestAnimationFrame(animate);
    if (frameMap) frameMap.set(element, id);
  });
}

/**
 * Smoothly animates the width of an SVG <rect> element from a starting value to a target value.
 *
 * The function uses requestAnimationFrame for smooth animation and cubic easing for a natural feel.
 * It can optionally manage and cancel overlapping animations for the same element using a WeakMap.
 *
 * @param element    The SVG <rect> element to animate.
 * @param from       The starting width.
 * @param to         The target width.
 * @param duration   Animation duration in milliseconds (default: 500).
 * @param onDone     Optional callback to run when the animation completes.
 * @param frameMap   Optional WeakMap<element, frameId> to auto-cancel previous animation on same element.
 *
 * @example
 * // 1. In your component, create a WeakMap to track animation frames:
 * private animationFrameIds = new WeakMap<SVGRectElement, number>();
 *
 * // 2. In your SVG template, assign a template reference variable to your <rect> element:
 * <rect #rudderWidth ... />
 *
 * // 3. In your component, get a reference to the element using viewChild:
 * private readonly rudderWidth = viewChild.required<ElementRef<SVGRectElement>>('rudderWidth');
 *
 * // 4. Use the utility to animate width:
 * import { animateRudderWidth } from 'src/app/core/utils/svg-animate.util';
 *
 * // (A) Simple:
 * animateRudderWidth(rectEl, oldWidth, newWidth);
 *
 * // (B) Outside Angular zone + callback:
 * const ngZone = inject(NgZone);
 * animateRudderWidth(rectEl, oldWidth, newWidth, 500, () => console.log('done'), frameMap, ngZone);
 *
 * // (C) Manual cancel:
 * const id = frameMap.get(rectEl); if (id) cancelAnimationFrame(id);
 */
export function animateRudderWidth(
  element: SVGRectElement,
  from: number,
  to: number,
  duration = 500,
  onDone?: () => void,
  frameMap?: WeakMap<SVGRectElement, number>,
  ngZone?: NgZone
) {
  if (frameMap) {
    const prevId = frameMap.get(element);
    if (prevId) cancelAnimationFrame(prevId);
  }
  const runOutside = (fn: () => void) => ngZone ? ngZone.runOutsideAngular(fn) : fn();
  const runInside = (fn: () => void) => ngZone ? ngZone.run(fn) : fn();

  runOutside(() => {
    const start = performance.now();
    const delta = to - from;
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      const current = from + delta * eased;
      element.setAttribute('width', current.toString());
      if (progress < 1) {
        const id = requestAnimationFrame(animate);
        if (frameMap) frameMap.set(element, id);
      } else {
        element.setAttribute('width', to.toString());
        if (onDone) runInside(onDone);
        if (frameMap) frameMap.delete(element);
      }
    };
    const id = requestAnimationFrame(animate);
    if (frameMap) frameMap.set(element, id);
  });
}

// ---- Generic path animation helpers (laylines & sectors) ----

/** Internal easing identical to other helpers */
const _easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Normalize angle to [0,360) */
const _norm = (a: number) => (a % 360 + 360) % 360;

/** Smallest signed delta (-180,180] */
const _angleDeltaSigned = (from: number, to: number) => {
  let d = _norm(to) - _norm(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};

/**
 * Animates an angle value (degrees) from "from" to "to" over duration using cubic easing.
 * Calls apply(currentAngle) each frame (angle already normalized to [0,360)).
 * If ngZone is provided, the loop runs outside Angular and onDone re-enters the zone.
 * Returns the requestAnimationFrame id.
 *
 * @example
 * // Layline angle inside component (outside zone):
 * this.portLaylineAnimId = animateAngleTransition(
 *   prevAngle,
 *   nextAngle,
 *   900,
 *   a => this.drawLayline(a, true),
 *   () => { this.portLaylineAnimId = null; },
 *   inject(NgZone)
 * );
 * // Cancel mid-animation:
 * cancelAnimationFrame(this.portLaylineAnimId!);
 */
export function animateAngleTransition(
  from: number,
  to: number,
  duration: number,
  apply: (currentAngle: number) => void,
  onDone?: () => void,
  ngZone?: NgZone
): number {
  const runOutside = (fn: () => void) => ngZone ? ngZone.runOutsideAngular(fn) : fn();
  const runInside = (fn: () => void) => ngZone ? ngZone.run(fn) : fn();
  let frameId = 0;
  runOutside(() => {
    const start = performance.now();
    const delta = _angleDeltaSigned(from, to);
    const base = _norm(from);
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = _easeInOutCubic(progress);
      const current = base + delta * eased;
      apply(_norm(current));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else if (onDone) {
        runInside(onDone);
      }
    };
    frameId = requestAnimationFrame(step);
  });
  return frameId;
}

export interface SectorAngles { min: number; mid: number; max: number; }

/** Linear interpolate sector angles */
const _lerpSector = (a: SectorAngles, b: SectorAngles, t: number): SectorAngles => ({
  min: a.min + (b.min - a.min) * t,
  mid: a.mid + (b.mid - a.mid) * t,
  max: a.max + (b.max - a.max) * t,
});

/**
 * Animates sector angles (min/mid/max) with easing.
 * Each frame apply(current) receives interpolated angles (not normalized for wrapping; supply original domain if needed).
 * If ngZone supplied, runs outside Angular.
 *
 * @example
 * this.portSectorAnimId = animateSectorTransition(
 *   prevState,
 *   nextState,
 *   900,
 *   s => this.portWindSectorPath = this.computeSectorPath(s, true),
 *   () => { this.portSectorAnimId = null; },
 *   inject(NgZone)
 * );
 * // Cancel:
 * cancelAnimationFrame(this.portSectorAnimId!);
 */
export function animateSectorTransition(
  from: SectorAngles,
  to: SectorAngles,
  duration: number,
  apply: (current: SectorAngles) => void,
  onDone?: () => void,
  ngZone?: NgZone
): number {
  const runOutside = (fn: () => void) => ngZone ? ngZone.runOutsideAngular(fn) : fn();
  const runInside = (fn: () => void) => ngZone ? ngZone.run(fn) : fn();
  let frameId = 0;
  runOutside(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = _easeInOutCubic(progress);
      apply(_lerpSector(from, to, eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else if (onDone) {
        runInside(onDone);
      }
    };
    frameId = requestAnimationFrame(step);
  });
  return frameId;
}
