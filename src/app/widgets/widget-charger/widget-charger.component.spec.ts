import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetChargerComponent } from './widget-charger.component';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import type { ITheme } from '../../core/services/app-service';
import { getElectricalWidgetFamilyDescriptor } from '../../core/contracts/electrical-widget-family.contract';

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
  value: unknown,
  state = States.Normal
): IPathUpdateWithPath => ({
  path,
  update: {
    data: { value, timestamp: new Date('2026-01-01T00:00:00.000Z') },
    state
  }
});

describe('WidgetChargerComponent', () => {
  let fixture: ComponentFixture<WidgetChargerComponent>;
  let component: WidgetChargerComponent;
  let liveSubject: Subject<IPathUpdateWithPath>;

  const dataServiceMock = { subscribePathTreeWithInitial: vi.fn() };
  const runtimeMock = { options: vi.fn() };
  const unitsMock = {
    convertToUnit: (_unit: string, value: unknown) => value,
    getDefaults: () => ({ Temperature: 'celsius' })
  };

  const setup = async (
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
      imports: [WidgetChargerComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetChargerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-charger-1');
    fixture.componentRef.setInput('type', 'widget-charger');
    fixture.componentRef.setInput('theme', themeMock);
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('subscribes to charger tree', async () => {
    await setup();
    const descriptor = getElectricalWidgetFamilyDescriptor('widget-charger');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenNthCalledWith(1, `${descriptor?.selfRootPath}.*`);
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenNthCalledWith(2, 'self.electrical.charger.*');
  });

  it('uses card mode metrics when display mode is card', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 27.5),
        makeUpdate('self.electrical.chargers.c1.current', 10),
        makeUpdate('self.electrical.chargers.c1.power', 275)
      ],
      {
        charger: {
          trackedIds: ['c1'],
          cardMode: {
            enabled: true,
            displayMode: 'card',
            metrics: ['voltage', 'power']
          }
        }
      }
    );

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    expect(models['c1']?.metricsLineOne).toContain('V ');
    expect(models['c1']?.metricsLineOne).toContain('P ');
    expect(`${models['c1']?.metricsLineOne} ${models['c1']?.metricsLineTwo}`).not.toContain('A ');
  });

  it('filters visible chargers by trackedIds', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28),
        makeUpdate('self.electrical.chargers.c2.voltage', 29)
      ],
      { charger: { trackedIds: ['c1'] } }
    );

    const visible = (component as unknown as { visibleChargerIds: () => string[] }).visibleChargerIds();
    expect(visible).toEqual(['c1']);
  });

  it('derives power from voltage and current', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.chargers.c1.voltage', 28));
    liveSubject.next(makeUpdate('self.electrical.chargers.c1.current', 5));
    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { chargersById: () => Record<string, { power?: number }> }).chargersById();
    expect(map['c1']?.power).toBe(140);
  });

  it('flushes the first live charger update immediately, then batches subsequent updates', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.chargers.c1.voltage', 28));

    let visible = (component as unknown as { visibleChargers: () => { id: string; voltage?: number | null; current?: number | null; power?: number | null }[] }).visibleChargers();
    expect(visible.map(item => item.id)).toEqual(['c1']);

    liveSubject.next(makeUpdate('self.electrical.chargers.c1.current', 5));

    await vi.advanceTimersByTimeAsync(499);
    visible = (component as unknown as { visibleChargers: () => { id: string; voltage?: number | null; current?: number | null; power?: number | null }[] }).visibleChargers();
    expect(visible[0]).toMatchObject({ id: 'c1', voltage: 28 });
    expect(visible[0]?.current).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    visible = (component as unknown as { visibleChargers: () => { id: string; voltage?: number | null; current?: number | null; power?: number | null }[] }).visibleChargers();
    expect(visible[0]).toMatchObject({ id: 'c1', voltage: 28, current: 5, power: 140 });
  });

  it('renders after live data arrives once svg is initialized', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.chargers.c1.name', 'Main Charger'));
    liveSubject.next(makeUpdate('self.electrical.chargers.c1.voltage', 28));
    liveSubject.next(makeUpdate('self.electrical.chargers.c1.current', 5));

    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const visible = (component as unknown as { visibleChargers: () => { id: string; name?: string | null }[] }).visibleChargers();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: 'c1', name: 'Main Charger' });
  });

  it('derives display colors from per-metric states', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.voltage', 28, States.Warn),
      makeUpdate('self.electrical.chargers.c1.current', 5, States.Alarm),
      makeUpdate('self.electrical.chargers.c1.temperature', 30, States.Normal)
    ]);

    const models = (component as unknown as {
      displayModels: () => Record<string, {
        stateBarColor: string;
        primaryMetricsTextColor: string;
        secondaryMetricsTextColor: string;
      }>;
    }).displayModels();

    expect(models['c1']?.stateBarColor).toBeTruthy();
    expect(models['c1']?.primaryMetricsTextColor).toBeTruthy();
    expect(models['c1']?.secondaryMetricsTextColor).toBeTruthy();
  });

  it('does not create a snapshot for nested sub-paths like c1.output.voltage', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.output.voltage', 28)
      ],
      { charger: { trackedIds: ['c1'] } }
    );

    // Parser uses first-segment ID and key=output.voltage; applyValue returns false
    // for unknown key, so no snapshot is materialized — matches BMS/Solar behavior
    const map = (component as unknown as { chargersById: () => Record<string, unknown> }).chargersById();
    expect(map['c1']).toBeUndefined();
  });

  it('does not create a snapshot from root-node updates (no leaf key)', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c7', { name: 'Main Charger' })
    ]);

    // Parser requires id + key; root-node paths with no dot after id are dropped
    const visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible.length).toBe(0);
  });

  it('supports legacy singular charger metric paths', async () => {
    await setup([
      makeUpdate('self.electrical.charger.c7.voltage', 27.2),
      makeUpdate('self.electrical.charger.c7.current', 4)
    ]);

    const map = (component as unknown as { chargersById: () => Record<string, { voltage?: number | null; current?: number | null; power?: number | null }> }).chargersById();
    expect(map['c7']?.voltage).toBe(27.2);
    expect(map['c7']?.current).toBe(4);
    expect(map['c7']?.power).toBeCloseTo(108.8);
  });

  it('supports legacy singular charger root-node instance updates', async () => {
    await setup([
      makeUpdate('self.electrical.charger.c8', { name: 'Legacy Charger' })
    ]);

    const visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe('c8');
  });

  it('does not create a snapshot when first key is unrecognized', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c9.customMetric', 12)
    ]);

    // applyValue returns false for unrecognized keys — no snapshot materialized
    const map = (component as unknown as { chargersById: () => Record<string, unknown> }).chargersById();
    expect(map['c9']).toBeUndefined();
  });
});
