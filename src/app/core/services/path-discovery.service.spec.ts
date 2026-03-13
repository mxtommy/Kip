import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PathDiscoveryService } from './path-discovery.service';
import { DataService } from './data.service';
import { IPathUpdateEvent } from '../interfaces/app-interfaces';

function makeEvent(fullPath: string, value: unknown): IPathUpdateEvent {
  return {
    fullPath,
    kind: 'data',
    update: {
      context: 'self',
      path: fullPath.replace(/^self\./, ''),
      source: 'default',
      timestamp: '2026-03-12T00:00:00.000Z',
      value
    }
  };
}

function makeStateEvent(fullPath: string): IPathUpdateEvent {
  return {
    fullPath,
    kind: 'state'
  };
}

describe('PathDiscoveryService', () => {
  let service: PathDiscoveryService;
  let pathUpdates$: Subject<IPathUpdateEvent>;
  let reset$: Subject<boolean>;
  let cachedPaths: string[];

  beforeEach(() => {
    pathUpdates$ = new Subject<IPathUpdateEvent>();
    reset$ = new Subject<boolean>();
    cachedPaths = [];

    TestBed.configureTestingModule({
      providers: [
        PathDiscoveryService,
        {
          provide: DataService,
          useValue: {
            observePathUpdates: () => pathUpdates$.asObservable(),
            isResetService: () => reset$.asObservable(),
            getCachedPaths: () => cachedPaths
          }
        }
      ]
    });
  });

  it('should include already-cached paths immediately on register', () => {
    cachedPaths = ['self.electrical.batteries.10.capacity.stateOfCharge'];

    service = TestBed.inject(PathDiscoveryService);

    const token = service.register({
      id: 'bms-batteries',
      patterns: ['self.electrical.batteries.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.batteries.']
    });

    expect(service.activePaths(token).has('self.electrical.batteries.10.capacity.stateOfCharge')).toBeTrue();
  });

  it('should add live paths from update stream', () => {
    service = TestBed.inject(PathDiscoveryService);

    const token = service.register({
      patterns: ['self.electrical.batteries.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.batteries.']
    });

    pathUpdates$.next(makeEvent('self.electrical.batteries.11.capacity.stateOfCharge', 0.6));

    expect(service.activePaths(token).has('self.electrical.batteries.11.capacity.stateOfCharge')).toBeTrue();
  });

  it('should clear seeded and live paths on reset', () => {
    cachedPaths = ['self.electrical.batteries.10.capacity.stateOfCharge'];
    service = TestBed.inject(PathDiscoveryService);

    const token = service.register({
      patterns: ['self.electrical.batteries.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.batteries.']
    });

    pathUpdates$.next(makeEvent('self.electrical.batteries.11.capacity.stateOfCharge', 0.6));
    reset$.next(true);

    expect(service.activePaths(token).size).toBe(0);
  });

  it('should add path on state-only event', () => {
    service = TestBed.inject(PathDiscoveryService);

    const token = service.register({
      patterns: ['self.electrical.batteries.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.batteries.']
    });

    pathUpdates$.next(makeStateEvent('self.electrical.batteries.12.capacity.stateOfCharge'));

    expect(service.activePaths(token).has('self.electrical.batteries.12.capacity.stateOfCharge')).toBeTrue();
  });
});
