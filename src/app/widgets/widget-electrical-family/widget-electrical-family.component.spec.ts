import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetElectricalFamilyComponent } from './widget-electrical-family.component';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import type { ITheme } from '../../core/services/app-service';

const themeMock = {
  contrast: '#fff',
  dim: '#ccc',
  dimmer: '#999',
  color: '#fff',
  zoneNominal: '#00ff00',
  zoneWarn: '#ffaa00',
  zoneAlarm: '#ff0000',
  zoneAlert: '#ff00ff'
} as unknown as ITheme;

const makeUpdate = (
  path: string,
  value: string | number | boolean | null,
  state = States.Normal
): IPathUpdateWithPath => ({
  path,
  update: {
    data: { value, timestamp: new Date('2026-01-01T00:00:00.000Z') },
    state
  }
});

describe('WidgetElectricalFamilyComponent', () => {
  let fixture: ComponentFixture<WidgetElectricalFamilyComponent>;
  let component: WidgetElectricalFamilyComponent;
  let liveSubject: Subject<IPathUpdateWithPath>;

  const dataServiceMock = { subscribePathTreeWithInitial: vi.fn() };
  const runtimeMock = { options: vi.fn() };
  const unitsMock = {
    convertToUnit: (_unit: string, value: unknown) => value,
    getDefaults: () => ({ Temperature: 'celsius' })
  };

  const setupComponent = async (
    familyKey: 'chargers' | 'inverters' | 'alternators' | 'ac',
    configKey: 'charger' | 'inverter' | 'alternator' | 'ac',
    initialUpdates: IPathUpdateWithPath[] = [],
    options: Record<string, unknown> = {}
  ) => {
    liveSubject = new Subject<IPathUpdateWithPath>();
    runtimeMock.options.mockReturnValue(options);
    dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
      initial: initialUpdates,
      live$: liveSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [WidgetElectricalFamilyComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetElectricalFamilyComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', `w-${familyKey}-1`);
    fixture.componentRef.setInput('type', `widget-${familyKey}`);
    fixture.componentRef.setInput('theme', themeMock);
    fixture.componentRef.setInput('familyKey', familyKey);
    fixture.componentRef.setInput('configKey', configKey);
    fixture.componentRef.setInput('title', familyKey.toUpperCase());
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // ─── Subscription root ───────────────────────────────────────────────────────

  it('subscribes to chargers subtree root', async () => {
    await setupComponent('chargers', 'charger');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.chargers.*');
  });

  it('subscribes to inverters subtree root', async () => {
    await setupComponent('inverters', 'inverter');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.inverters.*');
  });

  it('subscribes to alternators subtree root', async () => {
    await setupComponent('alternators', 'alternator');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.alternators.*');
  });

  it('subscribes to ac subtree root', async () => {
    await setupComponent('ac', 'ac');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.ac.*');
  });

  // ─── Initial flush ───────────────────────────────────────────────────────────

  it('flushes all initial paths synchronously and discovers all ids', async () => {
    await setupComponent('chargers', 'charger', [
      makeUpdate('self.electrical.chargers.ch1.voltage', 27.8),
      makeUpdate('self.electrical.chargers.ch2.voltage', 28.0)
    ]);

    const ids = (component as unknown as { discoveredIds: () => string[] }).discoveredIds();
    expect(ids).toEqual(['ch1', 'ch2']);
  });

  // ─── Live batching ────────────────────────────────────────────────────────────

  it('batches live updates within 500ms window before flushing', async () => {
    vi.useFakeTimers();
    // Start with initial data so cold-start flush has already happened
    await setupComponent('chargers', 'charger', [
      makeUpdate('self.electrical.chargers.ch0.voltage', 27.0)
    ]);

    // ch0 discovered from initial
    expect((component as unknown as { discoveredIds: () => string[] }).discoveredIds()).toEqual(['ch0']);

    // Two live updates arrive for new devices — should be batched, not immediately applied
    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.voltage', 27.8));
    liveSubject.next(makeUpdate('self.electrical.chargers.ch2.voltage', 28.0));

    // Still not flushed within window
    expect((component as unknown as { discoveredIds: () => string[] }).discoveredIds()).toEqual(['ch0']);

    await vi.advanceTimersByTimeAsync(500);

    const ids = (component as unknown as { discoveredIds: () => string[] }).discoveredIds();
    expect(ids).toContain('ch1');
    expect(ids).toContain('ch2');
  });

  it('last value wins when multiple updates for same key arrive before flush', async () => {
    vi.useFakeTimers();
    await setupComponent('chargers', 'charger');

    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.voltage', 10.0));
    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.voltage', 27.8));

    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { unitsById: () => Record<string, { voltage?: number }> }).unitsById();
    expect(map['ch1']?.voltage).toBe(27.8);
  });

  // ─── trackedIds filtering ─────────────────────────────────────────────────────

  it('shows only trackedIds when they are configured', async () => {
    await setupComponent('chargers', 'charger',
      [
        makeUpdate('self.electrical.chargers.ch1.voltage', 27.8),
        makeUpdate('self.electrical.chargers.ch2.voltage', 28.0),
        makeUpdate('self.electrical.chargers.ch3.voltage', 27.5)
      ],
      { charger: { trackedIds: ['ch1', 'ch3'] } }
    );

    const visible = (component as unknown as { visibleIds: () => string[] }).visibleIds();
    expect(visible).toEqual(['ch1', 'ch3']);
    expect(visible).not.toContain('ch2');
  });

  it('shows all discovered ids when trackedIds is empty', async () => {
    await setupComponent('inverters', 'inverter',
      [
        makeUpdate('self.electrical.inverters.inv1.voltage', 240.0),
        makeUpdate('self.electrical.inverters.inv2.voltage', 238.0)
      ],
      { inverter: { trackedIds: [] } }
    );

    const visible = (component as unknown as { visibleIds: () => string[] }).visibleIds();
    expect(visible).toEqual(['inv1', 'inv2']);
  });

  // ─── Power derivation ────────────────────────────────────────────────────────

  it('derives power from voltage × current when both are present', async () => {
    vi.useFakeTimers();
    await setupComponent('chargers', 'charger');

    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.voltage', 28.0));
    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.current', 5.0));

    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { unitsById: () => Record<string, { power?: number }> }).unitsById();
    expect(map['ch1']?.power).toBeCloseTo(140.0);
  });

  it('does not derive power when voltage is missing', async () => {
    vi.useFakeTimers();
    await setupComponent('chargers', 'charger');

    liveSubject.next(makeUpdate('self.electrical.chargers.ch1.current', 5.0));

    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { unitsById: () => Record<string, { power?: number | null }> }).unitsById();
    expect(map['ch1']?.power ?? null).toBeNull();
  });

  // ─── Name fallback ────────────────────────────────────────────────────────────

  it('falls back to id when name is missing', async () => {
    await setupComponent('alternators', 'alternator', [
      makeUpdate('self.electrical.alternators.alt1.voltage', 14.4)
    ]);

    const map = (component as unknown as { unitsById: () => Record<string, { id: string; name?: string | null }> }).unitsById();
    const unit = map['alt1'];
    expect((component as unknown as { displayName: (u: unknown) => string }).displayName(unit)).toBe('alt1');
  });

  it('uses name when it is present', async () => {
    await setupComponent('alternators', 'alternator', [
      makeUpdate('self.electrical.alternators.alt1.name', 'Main Alternator'),
      makeUpdate('self.electrical.alternators.alt1.voltage', 14.4)
    ]);

    const map = (component as unknown as { unitsById: () => Record<string, { id: string; name?: string | null }> }).unitsById();
    const unit = map['alt1'];
    expect((component as unknown as { displayName: (u: unknown) => string }).displayName(unit)).toBe('Main Alternator');
  });

  // ─── AC line metrics ─────────────────────────────────────────────────────────

  it('parses AC L1/L2/L3 line metrics into snapshot', async () => {
    vi.useFakeTimers();
    await setupComponent('ac', 'ac');

    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line1.voltage', 120.0));
    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line1.current', 10.0));
    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line2.voltage', 121.0));
    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line3.frequency', 60.0));

    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as {
      unitsById: () => Record<string, {
        line1Voltage?: number;
        line1Current?: number;
        line2Voltage?: number;
        line3Frequency?: number;
      }>
    }).unitsById();

    expect(map['bus1']?.line1Voltage).toBe(120.0);
    expect(map['bus1']?.line1Current).toBe(10.0);
    expect(map['bus1']?.line2Voltage).toBe(121.0);
    expect(map['bus1']?.line3Frequency).toBe(60.0);
  });

  // ─── associatedBus ────────────────────────────────────────────────────────────

  it('captures associatedBus for topology contract', async () => {
    await setupComponent('chargers', 'charger', [
      makeUpdate('self.electrical.chargers.ch1.associatedBus', 'house-bank')
    ]);

    const map = (component as unknown as { unitsById: () => Record<string, { associatedBus?: string | null }> }).unitsById();
    expect(map['ch1']?.associatedBus).toBe('house-bank');
  });
});
