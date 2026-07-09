import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AisProcessingService,
  AisVessel,
  AisAton,
  AisTrack
} from './ais-processing.service';
import { DataService, IPathUpdateWithPath } from './data.service';

/**
 * These tests lock in the `applyAisUpdate` path-dispatch behavior after it was
 * converted from a per-call `handlers` object literal to a `switch` statement.
 *
 * Events are driven through the real public entry point: the constructor
 * subscribes to `subscribePathTree(...)` streams, so pushing an
 * `IPathUpdateWithPath` through the mocked stream flows through
 * `handleAisTreeUpdate` -> `matchAisContext` -> `applyAisUpdate`. We then assert
 * the resulting track state the dispatch produced (see `trackByContext`).
 */
describe('AisProcessingService applyAisUpdate dispatch', () => {
  // Shared stream the constructor's merged AIS-tree subscriptions read from.
  let stream$: Subject<IPathUpdateWithPath>;
  let service: AisProcessingService;

  const VESSEL_CONTEXT = 'vessels.urn:mrn:imo:mmsi:123456789';
  const ATON_CONTEXT = 'atons.urn:mrn:imo:mmsi:987654321';

  function makeEvent(fullPath: string, value: unknown): IPathUpdateWithPath {
    return {
      path: fullPath,
      update: {
        data: { value, timestamp: new Date('2026-06-24T00:00:00Z') },
        state: 'normal'
      }
    } as IPathUpdateWithPath;
  }

  /**
   * Push a delta and flush the 250ms `targets` throttle so `targets()` updates.
   * The service is zoneless, so we drive RxJS's async scheduler with vitest's
   * fake timers (installed in beforeEach) instead of fakeAsync/tick.
   */
  function push(fullPath: string, value: unknown): void {
    stream$.next(makeEvent(fullPath, value));
    vi.advanceTimersByTime(300);
  }

  /**
   * Resolve the track the dispatch wrote to, straight from the service's
   * internal maps. We read internal state (not the public `targets()` signal)
   * because `flushTargetsSignal` filters out tracks that have neither an mmsi
   * nor a position - that filter is orthogonal to the dispatch under test, and
   * reading the raw track lets us assert string-only / status-only updates too.
   */
  function trackByContext(context: string): AisTrack | undefined {
    const internals = service as unknown as {
      contextIndex: Map<string, string>;
      tracks: Map<string, AisTrack>;
    };
    const id = internals.contextIndex.get(context);
    return id ? internals.tracks.get(id) : undefined;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    stream$ = new Subject<IPathUpdateWithPath>();

    const dataServiceMock: Partial<DataService> = {
      // Every prefix subscription shares the same stream; the merged pipeline
      // forwards anything we push. The self-nav stream also reads this but our
      // test paths only match AIS contexts, so they're routed correctly.
      subscribePathTree: () => stream$.asObservable(),
      removePathsForContext: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AisProcessingService,
        { provide: DataService, useValue: dataServiceMock }
      ]
    });

    service = TestBed.inject(AisProcessingService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets a vessel string field (name)', () => {
    push(`${VESSEL_CONTEXT}.name`, 'Test Vessel');

    const track = trackByContext(VESSEL_CONTEXT);
    expect(track).toBeDefined();
    expect(track!.type).toBe('vessel');
    expect(track!.name).toBe('Test Vessel');
  });

  it('sets a vessel numeric field gated by isVesselLike (speedOverGround)', () => {
    push(`${VESSEL_CONTEXT}.navigation.speedOverGround`, 5.5);

    const track = trackByContext(VESSEL_CONTEXT) as AisVessel;
    expect(track).toBeDefined();
    expect(track.speedOverGround).toBe(5.5);
  });

  it('sets a nested design field (design.length.overall)', () => {
    push(`${VESSEL_CONTEXT}.design.length.overall`, 42);

    const track = trackByContext(VESSEL_CONTEXT) as AisVessel;
    expect(track).toBeDefined();
    expect(track.design?.length?.overall).toBe(42);
  });

  it('merges nested design fields without clobbering siblings', () => {
    push(`${VESSEL_CONTEXT}.design.length.overall`, 42);
    push(`${VESSEL_CONTEXT}.design.beam`, 8);

    const track = trackByContext(VESSEL_CONTEXT) as AisVessel;
    expect(track.design?.length?.overall).toBe(42);
    expect(track.design?.beam).toBe(8);
  });

  it('applies a position update (latitude + longitude)', () => {
    push(`${VESSEL_CONTEXT}.navigation.position.latitude`, 48.5);
    push(`${VESSEL_CONTEXT}.navigation.position.longitude`, -123.25);

    const track = trackByContext(VESSEL_CONTEXT) as AisVessel;
    expect(track.position?.latitude).toBe(48.5);
    expect(track.position?.longitude).toBe(-123.25);
    expect(track.lastPositionAt).toBe(new Date('2026-06-24T00:00:00Z').getTime());
  });

  it('ignores a non-numeric latitude (early-out path -> break)', () => {
    push(`${VESSEL_CONTEXT}.navigation.position.latitude`, 'not-a-number');

    const track = trackByContext(VESSEL_CONTEXT) as AisVessel;
    // Track exists (created on resolve) but position was never set.
    expect(track).toBeDefined();
    expect(track.position).toBeUndefined();
  });

  it('sets an ATON field gated by isAton (atonType.name)', () => {
    push(`${ATON_CONTEXT}.atonType.name`, 'Buoy 7');

    const track = trackByContext(ATON_CONTEXT) as AisAton;
    expect(track).toBeDefined();
    expect(track.type).toBe('aton');
    expect(track.typeName).toBe('Buoy 7');
  });

  it('does NOT set a vessel-only field on an ATON (guard holds)', () => {
    // speedOverGround is gated by isVesselLike; an ATON must not receive it.
    push(`${ATON_CONTEXT}.atonType.name`, 'Buoy 7');
    push(`${ATON_CONTEXT}.navigation.speedOverGround`, 9);

    const track = trackByContext(ATON_CONTEXT);
    expect((track as AisAton).typeName).toBe('Buoy 7');
    // Vessel-only field must remain absent on the ATON.
    expect((track as unknown as AisVessel).speedOverGround).toBeUndefined();
  });

  it('removes the track when sensors.ais.status = "remove"', () => {
    // First give the vessel a name + position so it shows up as a target.
    push(`${VESSEL_CONTEXT}.name`, 'Doomed Vessel');
    push(`${VESSEL_CONTEXT}.navigation.position.latitude`, 10);
    push(`${VESSEL_CONTEXT}.navigation.position.longitude`, 20);
    expect(trackByContext(VESSEL_CONTEXT)).toBeDefined();

    push(`${VESSEL_CONTEXT}.sensors.ais.status`, 'remove');

    expect(trackByContext(VESSEL_CONTEXT)).toBeUndefined();
  });

  it('sets a normal ais status without removing the track', () => {
    push(`${VESSEL_CONTEXT}.name`, 'Live Vessel');
    push(`${VESSEL_CONTEXT}.sensors.ais.status`, 'confirmed');

    const track = trackByContext(VESSEL_CONTEXT);
    expect(track).toBeDefined();
    expect(track!.ais.status).toBe('confirmed');
  });
});

/**
 * Eviction bounds unbounded target growth (the "unresponsive after a while"
 * freeze): many Signal K setups never send an explicit `status: 'remove'`, so
 * every distinct MMSI ever heard used to accumulate for the app lifetime,
 * making every flush + radar render O(targets) and heavier over uptime.
 */
describe('AisProcessingService target eviction (bounds unbounded growth)', () => {
  let stream$: Subject<IPathUpdateWithPath>;
  let service: AisProcessingService;
  const EVENT_TS = new Date('2026-06-24T00:00:00Z').getTime();

  function makeEvent(fullPath: string, value: unknown): IPathUpdateWithPath {
    return { path: fullPath, update: { data: { value, timestamp: new Date(EVENT_TS) }, state: 'normal' } } as IPathUpdateWithPath;
  }
  function push(fullPath: string, value: unknown): void {
    stream$.next(makeEvent(fullPath, value));
    vi.advanceTimersByTime(300);
  }
  const internals = () => service as unknown as {
    tracks: Map<string, unknown>;
    contextIndex: Map<string, string>;
    mmsiIndex: Map<string, Set<string>>;
    maxTargets: number;
    targetTtlMs: number;
    evictStaleTracks: (nowMs: number) => void;
  };

  let removePathsForContext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    stream$ = new Subject<IPathUpdateWithPath>();
    removePathsForContext = vi.fn();
    TestBed.configureTestingModule({
      providers: [AisProcessingService, {
        provide: DataService,
        useValue: { subscribePathTree: () => stream$.asObservable(), removePathsForContext } as Partial<DataService>
      }]
    });
    service = TestBed.inject(AisProcessingService);
  });
  afterEach(() => vi.useRealTimers());

  it('caps the retained track set at maxTargets, evicting the oldest, and prunes the indexes', () => {
    internals().maxTargets = 5;
    for (let i = 0; i < 12; i++) {
      push(`vessels.urn:mrn:imo:mmsi:${100000000 + i}.navigation.position.latitude`, 10 + i * 0.001);
    }
    expect(internals().tracks.size).toBe(5);
    // indexes must not leak entries for evicted tracks
    expect(internals().contextIndex.size).toBe(5);
  });

  it('evicts tracks not updated within the TTL when the sweep runs', () => {
    push(`vessels.urn:mrn:imo:mmsi:123456789.navigation.position.latitude`, 10);
    expect(internals().tracks.size).toBe(1);
    // Move just beyond the configured TTL so this stays valid if TTL changes.
    internals().evictStaleTracks(EVENT_TS + internals().targetTtlMs + 1);
    expect(internals().tracks.size).toBe(0);
  });

  it('keeps tracks that were updated within the TTL', () => {
    push(`vessels.urn:mrn:imo:mmsi:123456789.navigation.position.latitude`, 10);
    internals().evictStaleTracks(EVENT_TS + Math.max(1, internals().targetTtlMs - 1));
    expect(internals().tracks.size).toBe(1);
  });

  it('cleans up DataService path data when a track is evicted by the TTL sweep', () => {
    push(`vessels.urn:mrn:imo:mmsi:123456789.navigation.position.latitude`, 10);
    internals().evictStaleTracks(EVENT_TS + internals().targetTtlMs + 1);
    expect(removePathsForContext).toHaveBeenCalledWith('vessels.urn:mrn:imo:mmsi:123456789');
  });

  it('cleans up DataService path data when a track is evicted by the max-targets cap', () => {
    internals().maxTargets = 5;
    for (let i = 0; i < 12; i++) {
      push(`vessels.urn:mrn:imo:mmsi:${100000000 + i}.navigation.position.latitude`, 10 + i * 0.001);
    }
    // The first 7 pushed tracks (100000000..100000006) were evicted to make room for the cap.
    expect(removePathsForContext).toHaveBeenCalledWith('vessels.urn:mrn:imo:mmsi:100000000');
    expect(removePathsForContext).toHaveBeenCalledWith('vessels.urn:mrn:imo:mmsi:100000006');
    expect(removePathsForContext).not.toHaveBeenCalledWith('vessels.urn:mrn:imo:mmsi:100000007');
  });
});

/**
 * Own-ship updates used to set the `ownShip` signal (a brand-new object) on every
 * self.navigation.* delta with no throttle/equality guard. The radar render effect
 * depends on ownShip(), so a moving/anchored vessel with a streaming compass drove
 * a full O(targets) re-render per fix. These tests pin the throttle + value guard.
 */
describe('AisProcessingService own-ship throttling', () => {
  let stream$: Subject<IPathUpdateWithPath>;
  let service: AisProcessingService;

  function push(fullPath: string, value: unknown): void {
    stream$.next({ path: fullPath, update: { data: { value, timestamp: new Date('2026-06-24T00:00:00Z') }, state: 'normal' } } as IPathUpdateWithPath);
    vi.advanceTimersByTime(300); // > 250ms throttle, so the throttled flush fires
  }

  beforeEach(() => {
    vi.useFakeTimers();
    stream$ = new Subject<IPathUpdateWithPath>();
    TestBed.configureTestingModule({
      providers: [AisProcessingService, {
        provide: DataService,
        useValue: { subscribePathTree: () => stream$.asObservable(), removePathsForContext: vi.fn() } as Partial<DataService>
      }]
    });
    service = TestBed.inject(AisProcessingService);
  });
  afterEach(() => vi.useRealTimers());

  it('does not emit a new ownShip object when the value is unchanged', () => {
    push('self.navigation.headingTrue', 1.5);
    const ref = service.ownShip();
    expect(ref.headingTrue).toBe(1.5);
    push('self.navigation.headingTrue', 1.5); // identical fix
    expect(service.ownShip()).toBe(ref);      // no redundant emission => stable reference
  });

  it('emits an updated ownShip when the value changes', () => {
    push('self.navigation.headingTrue', 1.5);
    push('self.navigation.headingTrue', 2.0);
    expect(service.ownShip().headingTrue).toBe(2.0);
  });
});
