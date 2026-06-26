import { describe, it, expect } from 'vitest';
import { gatherSnapshotTelemetry, type IPathValue } from './snapshot-telemetry.util';

const NOW = new Date(Date.UTC(2026, 5, 26, 4, 30, 15));

/** Build a path-getter from a plain {path: value} map. */
function getter(values: Record<string, unknown>) {
  return (path: string): IPathValue | null =>
    path in values ? { pathValue: values[path] } : null;
}

describe('gatherSnapshotTelemetry', () => {
  it('extracts position and converts SOG (m/s→knots) and COG (rad→deg)', () => {
    const t = gatherSnapshotTelemetry(getter({
      'self.navigation.position': { latitude: 48.8584, longitude: -2.2945 },
      'self.navigation.speedOverGround': 3.2922, // m/s ≈ 6.4 kn
      'self.navigation.courseOverGroundTrue': 3.7611 // rad ≈ 215.5°
    }), NOW);

    expect(t.latitude).toBeCloseTo(48.8584, 4);
    expect(t.longitude).toBeCloseTo(-2.2945, 4);
    expect(t.sogKnots).toBeCloseTo(6.4, 1);
    expect(t.cogDeg).toBeCloseTo(215.5, 1);
    expect(t.timestamp).toBe(NOW);
  });

  it('prefers true heading and reports the T reference', () => {
    const t = gatherSnapshotTelemetry(getter({
      'self.navigation.headingTrue': Math.PI, // 180°
      'self.navigation.headingMagnetic': 1
    }), NOW);
    expect(t.headingDeg).toBeCloseTo(180, 3);
    expect(t.headingRef).toBe('T');
  });

  it('falls back to magnetic heading with the M reference', () => {
    const t = gatherSnapshotTelemetry(getter({
      'self.navigation.headingMagnetic': Math.PI / 2 // 90°
    }), NOW);
    expect(t.headingDeg).toBeCloseTo(90, 3);
    expect(t.headingRef).toBe('M');
  });

  it('puts depth/wind/water-temp/STW in extra with converted, unit-suffixed keys', () => {
    const t = gatherSnapshotTelemetry(getter({
      'self.environment.depth.belowTransducer': 3.2,        // m
      'self.environment.wind.speedApparent': 7.2,           // m/s ≈ 14 kn
      'self.environment.water.temperature': 290.15,         // K = 17°C
      'self.navigation.speedThroughWater': 2.5722           // m/s ≈ 5 kn
    }), NOW);
    expect(t.extra?.['depthMeters']).toBeCloseTo(3.2, 2);
    expect(t.extra?.['windSpeedKnots'] as number).toBeCloseTo(14, 0);
    expect(t.extra?.['waterTempCelsius'] as number).toBeCloseTo(17, 1);
    expect(t.extra?.['stwKnots'] as number).toBeCloseTo(5, 0);
  });

  it('omits everything that is not present', () => {
    const t = gatherSnapshotTelemetry(getter({}), NOW);
    expect(t.latitude).toBeUndefined();
    expect(t.sogKnots).toBeUndefined();
    expect(t.headingDeg).toBeUndefined();
    expect(t.extra && Object.keys(t.extra).length ? t.extra : undefined).toBeUndefined();
    expect(t.timestamp).toBe(NOW);
  });
});
