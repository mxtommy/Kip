import { describe, it, expect } from 'vitest';
import { computeTrueWindBaseAngle } from './widget-windsteer.component';

/**
 * Regression tests for #1066 / #1063.
 *
 * In "simple" mode (enhanced/advanced compass mode OFF) the wind rose is bow-fixed, so the
 * True Wind ANGLE (boat-relative angleTrueWater / angleTrueGround) must be shown as-is, exactly
 * like Apparent Wind Angle. The previous code always added the boat heading to true wind,
 * turning it into a compass-frame direction, which displaced TWA by the heading (~90° in the
 * reports) only in simple mode. Enhanced mode rotates the dial by heading, so the offset is
 * correct there and must be preserved.
 */
describe('computeTrueWindBaseAngle (#1066, #1063)', () => {
  const TRUE_WATER = 'self.environment.wind.angleTrueWater';
  const TRUE_GROUND = 'self.environment.wind.angleTrueGround';
  const DIRECTION_TRUE = 'self.environment.wind.directionTrue';

  it('keeps boat-relative true wind angle unchanged in simple mode (compass mode off)', () => {
    // heading 90°, boat-relative TWA 45° -> must stay 45° in simple mode (NOT 135°)
    expect(computeTrueWindBaseAngle(TRUE_WATER, 45, 90, false)).toBe(45);
    expect(computeTrueWindBaseAngle(TRUE_GROUND, 45, 90, false)).toBe(45);
  });

  it('converts true wind angle to the compass frame (adds heading) in enhanced/compass mode', () => {
    expect(computeTrueWindBaseAngle(TRUE_WATER, 45, 90, true)).toBe(135);
  });

  it('wraps the compass-frame result into 0..359 in enhanced/compass mode', () => {
    expect(computeTrueWindBaseAngle(TRUE_WATER, 300, 90, true)).toBe(30); // 390 -> 30
  });

  it('passes through non boat-relative true wind paths (e.g. directionTrue) in both modes', () => {
    expect(computeTrueWindBaseAngle(DIRECTION_TRUE, 200, 90, false)).toBe(200);
    expect(computeTrueWindBaseAngle(DIRECTION_TRUE, 200, 90, true)).toBe(200);
  });
});
