import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { IMeta, IPathValueData } from '../interfaces/app-interfaces';
import { ISignalKDataValueUpdate, States } from '../interfaces/signalk-interfaces';
import { DataService, IPathUpdate, IPathUpdateWithPath } from './data.service';
import { SignalKDeltaService } from './signalk-delta.service';

describe('DataService', () => {
  let service: DataService;

  let dataPathUpdates$: Subject<IPathValueData>;
  let metadataUpdates$: Subject<IMeta>;
  let notificationUpdates$: Subject<ISignalKDataValueUpdate>;
  let selfUpdates$: Subject<string>;

  beforeEach(() => {
    dataPathUpdates$ = new Subject<IPathValueData>();
    metadataUpdates$ = new Subject<IMeta>();
    notificationUpdates$ = new Subject<ISignalKDataValueUpdate>();
    selfUpdates$ = new Subject<string>();

    TestBed.configureTestingModule({
      providers: [
        DataService,
        {
          provide: SignalKDeltaService,
          useValue: {
            subscribeDataPathsUpdates: () => dataPathUpdates$.asObservable(),
            subscribeMetadataUpdates: () => metadataUpdates$.asObservable(),
            subscribeNotificationsUpdates: () => notificationUpdates$.asObservable(),
            subscribeSelfUpdates: () => selfUpdates$.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(DataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('applies notification state to path value updates', () => {
    let latest: IPathUpdate | undefined;

    service
      .subscribePath('self.electrical.batteries.10.capacity.stateOfCharge', 'default')
      .subscribe(update => (latest = update));

    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.capacity.stateOfCharge',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:01.000Z',
      value: 0.47,
    });

    notificationUpdates$.next({
      path: 'notifications.electrical.batteries.10.capacity.stateOfCharge',
      value: {
        method: ['visual'],
        state: States.Warn,
        message: 'SOC warning',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(latest).toBeTruthy();
    expect(latest!.data.value).toBe(0.47);
    expect(latest!.state).toBe(States.Warn);
  });

  it('applies state when metadata is received before value and value arrives later', () => {
    notificationUpdates$.next({
      path: 'notifications.electrical.batteries.10.current',
      value: {
        method: ['visual'],
        state: States.Alert,
        message: 'Current alert',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    });

    metadataUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.current',
      meta: {
        description: 'Battery current',
        units: 'A',
        properties: {},
      },
    });

    let latest: IPathUpdate | undefined;

    service
      .subscribePath('self.electrical.batteries.10.current', 'default')
      .subscribe(update => (latest = update));

    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.current',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:01.000Z',
      value: 12.3,
    });

    expect(latest).toBeTruthy();
    expect(latest!.data.value).toBe(12.3);
    expect(latest!.state).toBe(States.Alert);
  });

  it('emits equivalent sequences for subscribePathTree and subscribePathTreeWithInitial', () => {
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:01.000Z',
      value: 12.5,
    });
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.11.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:02.000Z',
      value: 12.7,
    });
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.solar.1.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:03.000Z',
      value: 24.1,
    });

    const treeWithInitial = service.subscribePathTreeWithInitial('self.electrical.batteries.*');
    const treeInitial = treeWithInitial.initial;

    const fromTreeInitial: IPathUpdateWithPath[] = [];
    const fromTreeLive: IPathUpdateWithPath[] = [];
    let seen = 0;
    const subA = service.subscribePathTree('self.electrical.batteries.*').subscribe(update => {
      if (seen < treeInitial.length) {
        fromTreeInitial.push(update);
        seen++;
      } else {
        fromTreeLive.push(update);
      }
    });

    const fromInitialApiLive: IPathUpdateWithPath[] = [];
    const subB = treeWithInitial.live$.subscribe(update => {
      fromInitialApiLive.push(update);
    });

    expect(fromTreeInitial.length).toBe(treeInitial.length);
    expect(fromTreeInitial.map(item => item.path)).toEqual(treeInitial.map(item => item.path));
    expect(fromTreeInitial.map(item => item.update.data.value)).toEqual(treeInitial.map(item => item.update.data.value));

    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.12.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:04.000Z',
      value: 12.9,
    });

    expect(fromTreeLive.length).toBe(1);
    expect(fromInitialApiLive.length).toBe(1);
    expect(fromTreeLive[0].path).toBe('self.electrical.batteries.12.voltage');
    expect(fromInitialApiLive[0].path).toBe('self.electrical.batteries.12.voltage');
    expect(fromTreeLive[0].update.data.value).toBe(12.9);
    expect(fromInitialApiLive[0].update.data.value).toBe(12.9);

    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('emits equivalent sequences for source-specific reads', () => {
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:01.000Z',
      value: 12.5,
    });
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.11.voltage',
      source: 'other-source',
      timestamp: '2026-01-01T00:00:02.000Z',
      value: 99.1,
    });

    const treeWithInitial = service.subscribePathTreeWithInitial('self.electrical.batteries.*', 'test-source');
    const treeInitial = treeWithInitial.initial;

    const fromTreeInitial: IPathUpdateWithPath[] = [];
    const fromTreeLive: IPathUpdateWithPath[] = [];
    let seen = 0;
    const subA = service.subscribePathTree('self.electrical.batteries.*', 'test-source').subscribe(update => {
      if (seen < treeInitial.length) {
        fromTreeInitial.push(update);
        seen++;
      } else {
        fromTreeLive.push(update);
      }
    });

    const fromInitialApiLive: IPathUpdateWithPath[] = [];
    const subB = treeWithInitial.live$.subscribe(update => {
      fromInitialApiLive.push(update);
    });

    expect(fromTreeInitial.length).toBe(treeInitial.length);
    expect(fromTreeInitial.map(item => item.path)).toEqual(treeInitial.map(item => item.path));
    expect(fromTreeInitial.map(item => item.update.data.value)).toEqual(treeInitial.map(item => item.update.data.value));

    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.10.voltage',
      source: 'other-source',
      timestamp: '2026-01-01T00:00:03.000Z',
      value: 77.7,
    });
    dataPathUpdates$.next({
      context: 'self',
      path: 'electrical.batteries.12.voltage',
      source: 'test-source',
      timestamp: '2026-01-01T00:00:04.000Z',
      value: 12.9,
    });

    expect(fromTreeLive.length).toBe(2);
    expect(fromInitialApiLive.length).toBe(2);
    expect(fromTreeLive.map(item => item.path)).toEqual(fromInitialApiLive.map(item => item.path));
    expect(fromTreeLive.map(item => item.update.data.value)).toEqual(fromInitialApiLive.map(item => item.update.data.value));

    subA.unsubscribe();
    subB.unsubscribe();
  });
});
