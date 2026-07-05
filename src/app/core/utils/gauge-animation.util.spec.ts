import { describe, expect, it } from 'vitest';
import { GAUGE_ANIMATION_MS, gaugeAnimationDurationMs } from './gauge-animation.util';

describe('gaugeAnimationDurationMs', () => {
  it('uses a short fixed window instead of ~the whole sample interval', () => {
    // Old behavior would have been ~475ms (500 - 25); the gauge should now idle
    // for most of the interval.
    expect(gaugeAnimationDurationMs(500)).toBe(GAUGE_ANIMATION_MS);
    expect(gaugeAnimationDurationMs(500)).toBeLessThan(500);
  });

  it('never exceeds the sample interval (avoids a full duty cycle at fast rates)', () => {
    expect(gaugeAnimationDurationMs(100)).toBe(100);
  });

  it('falls back to the fixed window for invalid sample times', () => {
    expect(gaugeAnimationDurationMs(0)).toBe(GAUGE_ANIMATION_MS);
    expect(gaugeAnimationDurationMs(Number.NaN)).toBe(GAUGE_ANIMATION_MS);
  });
});
