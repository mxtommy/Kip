import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetAisRadarComponent } from './widget-ais-radar.component';

interface RadarTestHarness {
  units: { convertToUnit: (_unit: string, value: unknown) => unknown };
  ownShipLayer: object;
  ownShipVectorCache: unknown;
  rotationFrameTimer: number | null;
  renderFrame: number | null;
  ngZone: { runOutsideAngular: (fn: () => void) => void };
  renderVectorLines: ReturnType<typeof vi.fn>;
  scheduleRender: ReturnType<typeof vi.fn>;
  scheduleRotationOnlyRender: () => void;
  renderOwnShipVector: (ownShip: { courseOverGroundTrue?: number; speedOverGround?: number }, rangeNm: number, radius: number, viewRotation: number, cfg: Record<string, unknown>) => void;
}

describe('WidgetAisRadarComponent render safeguards', () => {
  let component: RadarTestHarness;
  const makeCfg = (overrides: Record<string, unknown> = {}) => ({
    ...(WidgetAisRadarComponent.DEFAULT_CONFIG.ais ?? {}),
    ...overrides
  });

  beforeEach(() => {
    component = Object.create(WidgetAisRadarComponent.prototype) as unknown as RadarTestHarness;
    component.units = {
      convertToUnit: (_unit: string, value: unknown) => value
    };
    component.ownShipLayer = {};
    component.ownShipVectorCache = null;
    component.rotationFrameTimer = null;
    component.renderFrame = null;
    component.ngZone = {
      runOutsideAngular: (fn: () => void) => fn()
    };
    component.renderVectorLines = vi.fn();
    component.scheduleRender = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses deadband 1.0 deg for rotation settle checks', () => {
    expect((WidgetAisRadarComponent as unknown as Record<string, number>)['ROTATION_SETTLE_DEADBAND_DEG']).toBe(1);
  });

  it('throttles rotation-only scheduling to one pending timeout', () => {
    vi.useFakeTimers();

    component.scheduleRotationOnlyRender();
    component.scheduleRotationOnlyRender();

    expect(component.scheduleRender).not.toHaveBeenCalled();
    expect(component.rotationFrameTimer).not.toBeNull();

    vi.advanceTimersByTime(33);

    expect(component.scheduleRender).toHaveBeenCalledTimes(1);
    expect(component.rotationFrameTimer).toBeNull();
  });

  it('reuses own-ship vector cache when only view rotation changes', () => {
    const ownShip = {
      courseOverGroundTrue: 90,
      speedOverGround: 5
    };
    const cfg = makeCfg({ showSelf: true, cogVectorsMinutes: 5 });

    component.renderOwnShipVector(ownShip, 12, 100, 0, cfg);
    const firstCache = component.ownShipVectorCache;

    component.renderOwnShipVector(ownShip, 12, 100, 15, cfg);
    const secondCache = component.ownShipVectorCache;

    expect(firstCache).toBeTruthy();
    expect(secondCache).toBe(firstCache);
    expect(component.renderVectorLines).toHaveBeenCalledTimes(2);

    const firstData = component.renderVectorLines.mock.calls[0][2];
    const secondData = component.renderVectorLines.mock.calls[1][2];

    expect(firstData[0].x1).not.toBe(secondData[0].x1);
    expect(firstData[0].y1).not.toBe(secondData[0].y1);
  });

  it('invalidates own-ship vector cache when vector inputs change', () => {
    const cfg = makeCfg({ showSelf: true, cogVectorsMinutes: 5 });

    component.renderOwnShipVector({ courseOverGroundTrue: 90, speedOverGround: 5 }, 12, 100, 0, cfg);
    const firstCache = component.ownShipVectorCache;

    component.renderOwnShipVector({ courseOverGroundTrue: 90, speedOverGround: 7 }, 12, 100, 0, cfg);
    const secondCache = component.ownShipVectorCache;

    expect(firstCache).toBeTruthy();
    expect(secondCache).toBeTruthy();
    expect(secondCache).not.toBe(firstCache);
  });

  it('clears own-ship cache and vectors when self display is disabled', () => {
    component.renderOwnShipVector({ courseOverGroundTrue: 90, speedOverGround: 5 }, 12, 100, 0, makeCfg({
      showSelf: true,
      cogVectorsMinutes: 5
    }));
    expect(component.ownShipVectorCache).toBeTruthy();

    component.renderOwnShipVector({ courseOverGroundTrue: 90, speedOverGround: 5 }, 12, 100, 0, makeCfg({
      showSelf: false,
      cogVectorsMinutes: 5
    }));

    expect(component.ownShipVectorCache).toBeNull();
    const calls = component.renderVectorLines.mock.calls;
    const lastData = calls[calls.length - 1][2];
    expect(lastData).toEqual([]);
  });
});
