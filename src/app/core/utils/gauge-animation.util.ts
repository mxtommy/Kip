/**
 * Animation duration (ms) for live ng-canvas gauges.
 *
 * The radial/compass gauges previously set `animationDuration = sampleTime - 25/50`,
 * i.e. the needle animation nearly filled the whole sample interval (~95% duty
 * cycle). A gauge fed changing data then repainted its needle layer almost
 * continuously via its own rAF loop, so a gauge-heavy dashboard stayed near the
 * frame budget on low-power marine hardware.
 *
 * A short fixed window leaves the gauge idle for most of each interval, clamped so
 * it never exceeds the sample interval itself (which would re-introduce a full
 * duty cycle at very fast sample rates).
 */
export const GAUGE_ANIMATION_MS = 120;

export function gaugeAnimationDurationMs(sampleTimeMs: number): number {
  if (!Number.isFinite(sampleTimeMs) || sampleTimeMs <= 0) return GAUGE_ANIMATION_MS;
  return Math.min(GAUGE_ANIMATION_MS, sampleTimeMs);
}
