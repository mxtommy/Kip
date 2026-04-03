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
  state = States.Normal,
  source?: string
): IPathUpdateWithPath => ({
  path,
  update: {
    data: { value, timestamp: new Date('2026-01-01T00:00:00.000Z') },
    state
  },
  ...(source ? { source } : {})
} as IPathUpdateWithPath);

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
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledTimes(1);
  });

  it('uses compact mode metrics when display mode is compact', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 27.5),
        makeUpdate('self.electrical.chargers.c1.current', 10),
        makeUpdate('self.electrical.chargers.c1.power', 275)
      ],
      {
        charger: {
          trackedDevices: [{ id: 'c1', source: 'default', key: 'c1||default' }],
          cardMode: {
            displayMode: 'compact',
            metrics: ['voltage', 'power']
          }
        }
      }
    );

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    expect(models['c1||default']?.metricsLineOne).toContain('V ');
    expect(models['c1||default']?.metricsLineOne).toContain('P ');
    expect(`${models['c1||default']?.metricsLineOne} ${models['c1||default']?.metricsLineTwo}`).not.toContain('A ');
  });

  it('prefers host renderMode input over config displayMode', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 27.5),
        makeUpdate('self.electrical.chargers.c1.current', 10),
        makeUpdate('self.electrical.chargers.c1.power', 275)
      ],
      {
        charger: {
          trackedDevices: [{ id: 'c1', source: 'default', key: 'c1||default' }],
          cardMode: {
            displayMode: 'full',
            metrics: ['current']
          }
        }
      }
    );

    fixture.componentRef.setInput('renderMode', 'compact');
    fixture.detectChanges();

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    const metricText = `${models['c1||default']?.metricsLineOne ?? ''} ${models['c1||default']?.metricsLineTwo ?? ''}`;
    expect(metricText).toContain('A ');
    expect(metricText).not.toContain('V ');
  });

  it('filters visible chargers by trackedDevices', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28),
        makeUpdate('self.electrical.chargers.c2.voltage', 29)
      ],
      { charger: { trackedDevices: [{ id: 'c1', source: 'default', key: 'c1||default' }] } }
    );

    const visible = (component as unknown as { visibleChargerKeys: () => string[] }).visibleChargerKeys();
    expect(visible).toEqual(['c1||default']);
  });

  it('shows all discovered chargers when no trackedDevices are configured', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.voltage', 28),
      makeUpdate('self.electrical.chargers.c2.voltage', 29)
    ]);

    const visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible.map(v => v.id).sort()).toEqual(['c1', 'c2']);
  });

  it('falls back to showing all chargers when trackedDevices is cleared after being set', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28),
        makeUpdate('self.electrical.chargers.c2.voltage', 29)
      ],
      { charger: { trackedDevices: [{ id: 'c1', source: 'default', key: 'c1||default' }] } }
    );

    let visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible.map(v => v.id)).toEqual(['c1']);

    runtimeMock.options.mockReturnValue({ charger: { trackedDevices: [] } });
    (component as unknown as { applyConfig: (cfg: unknown) => void }).applyConfig(
      { charger: { trackedDevices: [] } }
    );

    visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible.map(v => v.id).sort()).toEqual(['c1', 'c2']);
  });

  it('materializes separate cards for same id across different sources', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28),
        makeUpdate('self.electrical.chargers.c1.current', 10)
      ],
      {
        charger: {
          trackedDevices: [
            { id: 'c1', source: 'sourceA', key: 'c1||sourceA' },
            { id: 'c1', source: 'sourceB', key: 'c1||sourceB' }
          ]
        }
      }
    );

    const visible = (component as unknown as { visibleChargers: () => { id: string; source?: string | null; deviceKey?: string }[] }).visibleChargers();
    expect(visible).toHaveLength(2);
    expect(visible.find(v => v.deviceKey === 'c1||sourceA')).toBeDefined();
    expect(visible.find(v => v.deviceKey === 'c1||sourceB')).toBeDefined();

    const models = (component as unknown as { displayModels: () => Record<string, { busText: string }> }).displayModels();
    expect(models['c1||sourceA']?.busText).toBe('sourceA');
    expect(models['c1||sourceB']?.busText).toBe('sourceB');
  });

  it('applies source-qualified updates only to the matching tracked device key', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28, States.Normal, 'sourceA'),
        makeUpdate('self.electrical.chargers.c1.voltage', 31, States.Normal, 'sourceB')
      ],
      {
        charger: {
          trackedDevices: [
            { id: 'c1', source: 'sourceA', key: 'c1||sourceA' },
            { id: 'c1', source: 'sourceB', key: 'c1||sourceB' }
          ]
        }
      }
    );

    const map = (component as unknown as {
      chargersByKey: () => Record<string, { voltage?: number | null }>;
    }).chargersByKey();

    expect(map['c1||sourceA']?.voltage).toBe(28);
    expect(map['c1||sourceB']?.voltage).toBe(31);
  });

  it('falls back to fanout when source is missing on updates', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.c1.voltage', 28)
      ],
      {
        charger: {
          trackedDevices: [
            { id: 'c1', source: 'sourceA', key: 'c1||sourceA' },
            { id: 'c1', source: 'sourceB', key: 'c1||sourceB' }
          ]
        }
      }
    );

    const map = (component as unknown as {
      chargersByKey: () => Record<string, { voltage?: number | null }>;
    }).chargersByKey();

    expect(map['c1||sourceA']?.voltage).toBe(28);
    expect(map['c1||sourceB']?.voltage).toBe(28);
  });

  it('derives power from voltage and current', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.chargers.c1.voltage', 28));
    liveSubject.next(makeUpdate('self.electrical.chargers.c1.current', 5));
    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { chargersByKey: () => Record<string, { power?: number }> }).chargersByKey();
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

  it('maps extended charger key paths including nested output/input and mode/error/state fields', async () => {
    await setup(
      [
        makeUpdate('self.electrical.chargers.orion.state', 'on'),
        makeUpdate('self.electrical.chargers.orion.output.voltage', 27.8),
        makeUpdate('self.electrical.chargers.orion.offReason', 'none'),
        makeUpdate('self.electrical.chargers.orion.modeState', 'bulk'),
        makeUpdate('self.electrical.chargers.orion.input.voltage', 12.4),
        makeUpdate('self.electrical.chargers.orion.error', '0'),
        makeUpdate('self.electrical.chargers.house.voltage', 27.5),
        makeUpdate('self.electrical.chargers.house.temperature', 31.2),
        makeUpdate('self.electrical.chargers.house.power', 300),
        makeUpdate('self.electrical.chargers.house.name', 'House Charger'),
        makeUpdate('self.electrical.chargers.house.modeNumber', 2),
        makeUpdate('self.electrical.chargers.house.mode', 'absorption'),
        makeUpdate('self.electrical.chargers.house.leds.temperature', true),
        makeUpdate('self.electrical.chargers.house.leds.overload', false),
        makeUpdate('self.electrical.chargers.house.leds.mains', true),
        makeUpdate('self.electrical.chargers.house.leds.lowBattery', false),
        makeUpdate('self.electrical.chargers.house.leds.inverter', false),
        makeUpdate('self.electrical.chargers.house.leds.float', true),
        makeUpdate('self.electrical.chargers.house.leds.bulk', false),
        makeUpdate('self.electrical.chargers.house.leds.absorption', true),
        makeUpdate('self.electrical.chargers.house.current', 10),
        makeUpdate('self.electrical.chargers.house.chargingModeNumber', 3),
        makeUpdate('self.electrical.chargers.house.chargingMode', 'float')
      ],
      {
        charger: {
          trackedDevices: [
            { id: 'orion', source: 'default', key: 'orion||default' },
            { id: 'house', source: 'default', key: 'house||default' }
          ]
        }
      }
    );

    const map = (component as unknown as {
      chargersByKey: () => Record<string, {
        state?: string | null;
        outputVoltage?: number | null;
        voltage?: number | null;
        offReason?: string | null;
        mode?: string | null;
        inputVoltage?: number | null;
        error?: string | null;
        temperature?: number | null;
        rawPower?: number | null;
        modeNumber?: number | null;
        chargingModeNumber?: number | null;
        chargingMode?: string | null;
        ledsTemperature?: boolean | null;
        ledsOverload?: boolean | null;
        ledsMains?: boolean | null;
        ledsLowBattery?: boolean | null;
        ledsInverter?: boolean | null;
        ledsFloat?: boolean | null;
        ledsBulk?: boolean | null;
        ledsAbsorption?: boolean | null;
      }>;
    }).chargersByKey();

    expect(map['orion||default']?.state).toBe('on');
    expect(map['orion||default']?.outputVoltage).toBe(27.8);
    expect(map['orion||default']?.voltage).toBe(27.8);
    expect(map['orion||default']?.offReason).toBe('none');
    expect(map['orion||default']?.mode).toBe('bulk');
    expect(map['orion||default']?.inputVoltage).toBe(12.4);
    expect(map['orion||default']?.error).toBe('0');

    expect(map['house||default']?.voltage).toBe(27.5);
    expect(map['house||default']?.temperature).toBe(31.2);
    expect(map['house||default']?.rawPower).toBe(300);
    expect(map['house||default']?.modeNumber).toBe(2);
    expect(map['house||default']?.mode).toBe('absorption');
    expect(map['house||default']?.ledsTemperature).toBe(true);
    expect(map['house||default']?.ledsOverload).toBe(false);
    expect(map['house||default']?.ledsMains).toBe(true);
    expect(map['house||default']?.ledsLowBattery).toBe(false);
    expect(map['house||default']?.ledsInverter).toBe(false);
    expect(map['house||default']?.ledsFloat).toBe(true);
    expect(map['house||default']?.ledsBulk).toBe(false);
    expect(map['house||default']?.ledsAbsorption).toBe(true);
    expect(map['house||default']?.chargingModeNumber).toBe(3);
    expect(map['house||default']?.chargingMode).toBe('float');
  });

  it('does not create a snapshot from root-node updates (no leaf key)', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c7', { name: 'Main Charger' })
    ]);

    // Parser requires id + key; root-node paths with no dot after id are dropped
    const visible = (component as unknown as { visibleChargers: () => { id: string }[] }).visibleChargers();
    expect(visible.length).toBe(0);
  });

  it('does not create a snapshot when first key is unrecognized', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c9.customMetric', 12)
    ]);

    // applyValue returns false for unrecognized keys — no snapshot materialized
    const map = (component as unknown as { chargersByKey: () => Record<string, unknown> }).chargersByKey();
    expect(map['c9']).toBeUndefined();
  });
});
