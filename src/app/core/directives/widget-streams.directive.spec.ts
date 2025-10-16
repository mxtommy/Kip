import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, Observable } from 'rxjs';
import { WidgetStreamsDirective } from './widget-streams.directive';
import { DataService, IPathUpdate } from '../services/data.service';
import { UnitsService } from '../services/units.service';
import { IWidgetSvcConfig, IWidgetPath } from '../interfaces/widgets-interface';

class FakeDataService {
  calls: { path: string; source: string }[] = [];
  subjects = new Map<string, Subject<IPathUpdate>>();
  timeoutCalls: { path: string; pathType: string }[] = [];

  subscribePath(path: string, source?: string): Observable<IPathUpdate> {
    const src = (source?.trim() || 'default');
    const key = `${path}|${src}`;
    this.calls.push({ path, source: src });
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new Subject<IPathUpdate>());
    }
    return this.subjects.get(key)!.asObservable();
  }

  timeoutPathObservable(path: string, pathType: string): void {
    this.timeoutCalls.push({ path, pathType });
  }
}

class FakeUnitsService {
  convertToUnit(unit: string, value: number): number {
    if (unit === 'x10') return value * 10;
    return value;
  }
}

function makeCfg(opts: {
  key?: string;
  path?: string | null;
  pathType?: 'number' | 'string' | 'Date' | 'boolean';
  sampleTime?: number;
  convertUnitTo?: string | null;
  source?: string | null;
  displayName?: string;
  enableTimeout?: boolean;
  dataTimeout?: number;
} = {}): IWidgetSvcConfig {
  const key = opts.key ?? 'p';
  const paths: Record<string, IWidgetPath> = {
    [key]: {
      description: 'Test path',
      path: opts.path ?? 'navigation.test',
      pathID: 'id-1',
      source: (opts.source ?? null),
      pathType: opts.pathType ?? 'string',
      isPathConfigurable: true,
      showPathSkUnitsFilter: false,
      pathSkUnitsFilter: null,
      convertUnitTo: (opts.convertUnitTo ?? undefined) as unknown as string,
      sampleTime: opts.sampleTime ?? 1000,
      supportsPut: false
    }
  };
  return {
    displayName: opts.displayName ?? 'Test Widget',
    filterSelfPaths: true,
    paths,
    enableTimeout: opts.enableTimeout ?? false,
    dataTimeout: opts.dataTimeout ?? 5,
    color: 'contrast',
    putEnable: false,
    putMomentary: false,
    multiChildCtrls: []
  };
}

describe('WidgetStreamsDirective', () => {
  let directive: WidgetStreamsDirective;
  let dataSvc: FakeDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WidgetStreamsDirective,
        { provide: DataService, useClass: FakeDataService },
        { provide: UnitsService, useClass: FakeUnitsService }
      ]
    });
    directive = TestBed.inject(WidgetStreamsDirective);
    dataSvc = TestBed.inject(DataService) as unknown as FakeDataService;
  });

  it('subscribes and receives updates for a valid path', (done) => {
    const cfg = makeCfg({ path: 'env.test', source: null, pathType: 'string', sampleTime: 50 });
    directive.setStreamsConfig(cfg);

    const received: unknown[] = [];
    directive.observe('p', update => {
      received.push(update?.data?.value);
      if (received.length === 2) {
        expect(received).toEqual(['A', 'B']);
        done();
      }
    });

    const subj = dataSvc.subjects.get('env.test|default')!;
    subj.next({ data: { value: 'A', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 'B', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
  });

  it('resubscribes to DataService when source changes', (done) => {
    const cfg1 = makeCfg({ path: 'env.switch', source: null, pathType: 'string', sampleTime: 50 });
    directive.setStreamsConfig(cfg1);

    const hits: string[] = [];
    directive.observe('p', update => {
      hits.push(String(update?.data?.value));
      if (hits.length === 3) {
        expect(hits).toEqual(['A1', 'B2', 'B3']);
        const sources = dataSvc.calls.map(c => c.source);
        expect(sources).toContain('default');
        expect(sources).toContain('n2k');
        done();
      }
    });

    const subjDefault = dataSvc.subjects.get('env.switch|default')!;
    subjDefault.next({ data: { value: 'A1', timestamp: new Date() }, state: 'normal' } as IPathUpdate);

    const cfg2 = makeCfg({ path: 'env.switch', source: 'n2k', pathType: 'string', sampleTime: 50 });
    directive.applyStreamsConfigDiff(cfg2);

    // Old source should no longer be listened to
    subjDefault.next({ data: { value: 'A2', timestamp: new Date() }, state: 'normal' } as IPathUpdate);

    const subjN2k = dataSvc.subjects.get('env.switch|n2k')!;
    subjN2k.next({ data: { value: 'B2', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subjN2k.next({ data: { value: 'B3', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
  });

  it('does not resubscribe within the default source cluster', () => {
    const cfg1 = makeCfg({ path: 'nav.x', source: undefined });
    directive.setStreamsConfig(cfg1);
    directive.observe('p', () => { /* noop */ });

    const initialCalls = dataSvc.calls.length;

    const cfg2 = makeCfg({ path: 'nav.x', source: '' });
    directive.applyStreamsConfigDiff(cfg2);

    const cfg3 = makeCfg({ path: 'nav.x', source: null });
    directive.applyStreamsConfigDiff(cfg3);

    expect(dataSvc.calls.length).toBe(initialCalls);
  });

  it('replaces observer when observe() is called with a new callback', (done) => {
    const cfg = makeCfg({ path: 'env.obs', source: null });
    directive.setStreamsConfig(cfg);

    const hitsA: string[] = [];
    const hitsB: string[] = [];

    const cbA = (u: IPathUpdate) => hitsA.push(u?.data?.value);
    const cbB = (u: IPathUpdate) => {
      hitsB.push(u?.data?.value);
      if (hitsB.length === 2) {
        expect(hitsA).toEqual(['X1']);
        expect(hitsB).toEqual(['X2', 'X3']);
        done();
      }
    };

    directive.observe('p', cbA);
    const subj = dataSvc.subjects.get('env.obs|default')!;
    subj.next({ data: { value: 'X1', timestamp: new Date() }, state: 'normal' } as IPathUpdate);

    directive.observe('p', cbB);
    subj.next({ data: { value: 'X2', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 'X3', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
  });

  it('cleans up subscription when path becomes empty', () => {
    const cfg1 = makeCfg({ path: 'env.clean', source: null });
    directive.setStreamsConfig(cfg1);

    const received: unknown[] = [];
    directive.observe('p', u => received.push(u?.data?.value));

    const subj = dataSvc.subjects.get('env.clean|default')!;
    subj.next({ data: { value: 'C1', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    expect(received).toEqual(['C1']);

    const cfg2 = makeCfg({ path: '' as string, source: null });
    directive.applyStreamsConfigDiff(cfg2);

    subj.next({ data: { value: 'C2', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    expect(received).toEqual(['C1']);
  });

  it('does nothing when observing the same signature twice', (done) => {
    const cfg = makeCfg({ path: 'env.same', source: null, pathType: 'string', sampleTime: 50 });
    directive.setStreamsConfig(cfg);

    const hits: string[] = [];
    const cb = (u: IPathUpdate) => {
      hits.push(String(u?.data?.value));
      if (hits.length === 2) {
        // Only one subscription should have been created
        expect(dataSvc.calls.length).toBe(1);
        expect(dataSvc.calls[0]).toEqual({ path: 'env.same', source: 'default' });
        expect(hits).toEqual(['S1', 'S2']);
        done();
      }
    };

    // Call observe twice with the same callback and unchanged config
    directive.observe('p', cb);
    const subj = dataSvc.subjects.get('env.same|default')!;
    subj.next({ data: { value: 'S1', timestamp: new Date() }, state: 'normal' } as IPathUpdate);

    directive.observe('p', cb);
    // No new subscribePath call should occur
    expect(dataSvc.calls.length).toBe(1);
    subj.next({ data: { value: 'S2', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
  });

  it('does not subscribe when observing empty path twice', () => {
    const cfg = makeCfg({ path: '' as string, source: null });
    directive.setStreamsConfig(cfg);

    const cb = () => { /* noop */ };
    directive.observe('p', cb);
    directive.observe('p', cb);

    // No DataService.subscribePath should have been called
    expect(dataSvc.calls.length).toBe(0);
  });

  it('rewires pipeline on signature change (convertUnitTo) while reusing base stream', () => {
    // Initial config: number path, no conversion
    const cfg1 = makeCfg({ path: 'env.rewire', source: null, pathType: 'number', sampleTime: 50 });
    directive.setStreamsConfig(cfg1);

    const hits: number[] = [];
    directive.observe('p', u => hits.push(u?.data?.value as number));

    // Single base subscription should be created
    expect(dataSvc.calls.length).toBe(1);
    expect(dataSvc.calls[0]).toEqual({ path: 'env.rewire', source: 'default' });

    const subj = dataSvc.subjects.get('env.rewire|default')!;
    subj.next({ data: { value: 2, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    expect(hits).toEqual([2]);

    // Change only convertUnitTo (part of signature), keep base identity (path+source) the same
    const cfg2 = makeCfg({ path: 'env.rewire', source: null, pathType: 'number', convertUnitTo: 'x10', sampleTime: 50 });
    directive.applyStreamsConfigDiff(cfg2);

    // DataService should NOT have been called again (base reused)
    expect(dataSvc.calls.length).toBe(1);

    // Next emission should reflect new pipeline (converted by x10)
    subj.next({ data: { value: 3, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    expect(hits).toEqual([2, 30]);
  });

  it('applies sampleTime: emits initial immediately and latest per interval', fakeAsync(() => {
    const cfg = makeCfg({ path: 'env.sample', source: null, pathType: 'string', sampleTime: 50 });
    directive.setStreamsConfig(cfg);

    const hits: string[] = [];
    directive.observe('p', u => hits.push(String(u?.data?.value)));

    const subj = dataSvc.subjects.get('env.sample|default')!;
    // Emit two quick values; first should be received immediately (initial$),
    // second should appear after the sample window as the latest sampled value.
    subj.next({ data: { value: 'A', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 'B', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(60);
    expect(hits).toEqual(['A', 'B']);

    // Next value appears at next sampling tick
    subj.next({ data: { value: 'C', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(60);
    expect(hits).toEqual(['A', 'B', 'C']);
  }));

  it('triggers timeout and calls DataService.timeoutPathObservable', fakeAsync(() => {
    // Silence noisy console logs from timeout/retry handling to keep test output clean
    spyOn(console, 'log');
    // Configure a very short timeout (seconds) so the test runs fast
    const cfg = makeCfg({ path: 'env.to', source: null, pathType: 'string', sampleTime: 100, displayName: 'Test', enableTimeout: true, dataTimeout: 0.02 });
    directive.setStreamsConfig(cfg);

    const hits: string[] = [];
    directive.observe('p', u => hits.push(String(u?.data?.value)));

    // Do not emit anything; advance virtual time beyond 20ms to trigger timeout
    tick(30);
    expect(dataSvc.timeoutCalls.length).toBe(1);
    expect(dataSvc.timeoutCalls[0]).toEqual({ path: 'env.to', pathType: 'string' });
  }));

  it('applies convertUnitTo to numeric values (initial + sampled)', fakeAsync(() => {
    const cfg = makeCfg({ path: 'env.units', source: null, pathType: 'number', sampleTime: 50, convertUnitTo: 'x10' });
    directive.setStreamsConfig(cfg);

    const hits: number[] = [];
    directive.observe('p', u => hits.push(u?.data?.value as number));

    const subj = dataSvc.subjects.get('env.units|default')!;
    // Initial should be converted immediately
    subj.next({ data: { value: 1, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    // Next two quick emissions; only latest sampled should be delivered after tick
    subj.next({ data: { value: 2, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 3, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(60);
    expect(hits).toEqual([10, 30]);
  }));

  it('supports observer-level min/max compounding with sampling', fakeAsync(() => {
    const cfg = makeCfg({ path: 'env.stats', source: null, pathType: 'number', sampleTime: 40 });
    directive.setStreamsConfig(cfg);

    const stats = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, values: [] as number[] };
    directive.observe('p', u => {
      const v = u?.data?.value as number;
      stats.values.push(v);
      if (v < stats.min) stats.min = v;
      if (v > stats.max) stats.max = v;
    });

    const subj = dataSvc.subjects.get('env.stats|default')!;
    // Initial emission updates min/max immediately
    subj.next({ data: { value: 5, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    expect(stats.values).toEqual([5]);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);

    // Burst of values within one sample window - only last should be sampled in next tick
    subj.next({ data: { value: 7, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 3, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 9, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(45);
    // After first sampling window: min/max should reflect 5 (initial) and 9 (sampled)
    expect(stats.values).toEqual([5, 9]);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(9);

    // Another burst leading to a new higher max; the lower value '1' occurs within
    // the sample window but is not the latest, so it is not observed by the subscriber.
    subj.next({ data: { value: 1, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 12, timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(45);
    expect(stats.values).toEqual([5, 9, 12]);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(12);
  }));

  it('updates sampling cadence when sampleTime changes without resubscribing base', fakeAsync(() => {
    // Initial sampleTime: 100ms
    const cfg1 = makeCfg({ path: 'env.cadence', source: null, pathType: 'string', sampleTime: 100 });
    directive.setStreamsConfig(cfg1);

    const hits: string[] = [];
    directive.observe('p', u => hits.push(String(u?.data?.value)));

    // One base subscription should be created
    expect(dataSvc.calls.length).toBe(1);
    expect(dataSvc.calls[0]).toEqual({ path: 'env.cadence', source: 'default' });

    const subj = dataSvc.subjects.get('env.cadence|default')!;
    // Initial emission is immediate
    subj.next({ data: { value: 'A', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    // Burst within first 100ms window
    subj.next({ data: { value: 'B', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 'C', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    // Not yet at 100ms: should still only have initial
    tick(90);
    expect(hits).toEqual(['A']);
    // Cross the first sampling boundary: latest ('C') is emitted
    tick(20);
    expect(hits).toEqual(['A', 'C']);

    // Change only sampleTime to 30ms; base identity (path+source) unchanged
    const cfg2 = makeCfg({ path: 'env.cadence', source: null, pathType: 'string', sampleTime: 30 });
    directive.applyStreamsConfigDiff(cfg2);

    // DataService should NOT have been called again (no new base subscription)
    expect(dataSvc.calls.length).toBe(1);

    // New emissions under the new 30ms cadence
    subj.next({ data: { value: 'D', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    subj.next({ data: { value: 'E', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    // After rewire, the first next value ('D') is emitted immediately (initial$),
    // and then sampling resumes for subsequent values.
    tick(20);
    expect(hits).toEqual(['A', 'C', 'D']);
    // After crossing 30ms boundary, latest ('E') should be emitted
    tick(15);
    expect(hits).toEqual(['A', 'C', 'D', 'E']);

    // Next single value should appear after next 30ms window
    subj.next({ data: { value: 'F', timestamp: new Date() }, state: 'normal' } as IPathUpdate);
    tick(35);
    expect(hits).toEqual(['A', 'C', 'D', 'E', 'F']);
  }));
});
