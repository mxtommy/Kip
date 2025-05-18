/**
 * Smoothly animates the rotation of an SVG <g> element from a starting angle to a target angle.
 *
 * The function uses requestAnimationFrame for smooth animation and cubic easing for a natural feel.
 * It can optionally manage and cancel overlapping animations for the same element using a WeakMap.
 *
 * @param element    The SVG <g> element to rotate.
 * @param from       The starting angle in degrees.
 * @param to         The target angle in degrees.
 * @param duration   Animation duration in milliseconds (default: 1000).
 * @param onDone     Optional callback to run when the animation completes.
 * @param frameMap   Optional WeakMap to track/cancel ongoing animations for each element.
 * @param center     Optional [cx, cy] array for the rotation center (default: [500, 500]).
 *
 * @example
 * // 1. In your component, create a WeakMap to track animation frames:
 * private animationFrameIds = new WeakMap<SVGGElement, number>();
 *
 * // 2. In your SVG template, assign a template reference variable to your <g> element:
 * <g #rotatingDial> ... </g>
 *
 * // 3. In your component, get a reference to the element using @ViewChild:
 * @ViewChild('rotatingDial', { static: true }) rotatingDial!: ElementRef<SVGGElement>;
 *
 * // 4. Use the utility to animate rotation (with custom center):
 * import { animateRotation } from 'src/app/core/utils/svg-animate.util';
 *
 * animateRotation(
 *   this.rotatingDial.nativeElement,
 *   oldAngle,
 *   newAngle,
 *   800,
 *   () => console.log('Rotation done!'),
 *   this.animationFrameIds,
 *   [400, 400] // custom center coordinates
 * );
 */
export function animateRotation(
  element: SVGGElement,
  from: number,
  to: number,
  duration: number = 1000,
  onDone?: () => void,
  frameMap?: WeakMap<SVGGElement, number>,
  center: [number, number] = [500, 500]
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
      if (onDone) onDone();
      if (frameMap) frameMap.delete(element);
    }
  };
  const id = requestAnimationFrame(animate);
  if (frameMap) frameMap.set(element, id);
}
