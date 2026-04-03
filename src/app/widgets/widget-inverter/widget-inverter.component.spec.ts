import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetInverterComponent } from './widget-inverter.component';
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

describe('WidgetInverterComponent', () => {
  let fixture: ComponentFixture<WidgetInverterComponent>;
  let component: WidgetInverterComponent;
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
      imports: [WidgetInverterComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetInverterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-inverter-1');
    fixture.componentRef.setInput('type', 'widget-inverter');
    fixture.componentRef.setInput('theme', themeMock);
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('subscribes to the inverter path tree', async () => {
    await setup();
    const descriptor = getElectricalWidgetFamilyDescriptor('widget-inverter');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenNthCalledWith(1, `${descriptor?.selfRootPath}.*`);
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledTimes(1);
  });

  it('filters visible inverters by trackedDevices', async () => {
    await setup(
      [
        makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
        makeUpdate('self.electrical.inverters.i2.dc.voltage', 50)
      ],
      { inverter: { trackedDevices: [{ id: 'i1', source: 'default', key: 'i1||default' }] } }
    );

    const visible = (component as unknown as { visibleInverterKeys: () => string[] }).visibleInverterKeys();
    expect(visible).toEqual(['i1||default']);
  });

  it('shows all discovered inverters when no trackedDevices are configured', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
      makeUpdate('self.electrical.inverters.i2.dc.voltage', 50)
    ]);

    const visible = (component as unknown as { visibleInverters: () => { id: string }[] }).visibleInverters();
    expect(visible.map(v => v.id).sort()).toEqual(['i1', 'i2']);
  });

  it('falls back to showing all inverters when trackedDevices is cleared after being set', async () => {
    await setup(
      [
        makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
        makeUpdate('self.electrical.inverters.i2.dc.voltage', 50)
      ],
      { inverter: { trackedDevices: [{ id: 'i1', source: 'default', key: 'i1||default' }] } }
    );

    // Verify only i1 is visible with tracking active
    let visible = (component as unknown as { visibleInverters: () => { id: string }[] }).visibleInverters();
    expect(visible.map(v => v.id)).toEqual(['i1']);

    // Clear tracking — all inverters should now be visible
    runtimeMock.options.mockReturnValue({ inverter: { trackedDevices: [] } });
    (component as unknown as { applyConfig: (cfg: unknown) => void }).applyConfig(
      { inverter: { trackedDevices: [] } }
    );

    visible = (component as unknown as { visibleInverters: () => { id: string }[] }).visibleInverters();
    expect(visible.map(v => v.id).sort()).toEqual(['i1', 'i2']);
  });

  it('parses dc.voltage and dc.current path keys', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
      makeUpdate('self.electrical.inverters.i1.dc.current', 10)
    ]);

    const map = (component as unknown as { invertersByKey: () => Record<string, { dcVoltage?: number | null; dcCurrent?: number | null }> }).invertersByKey();
    expect(map['i1']?.dcVoltage).toBe(48);
    expect(map['i1']?.dcCurrent).toBe(10);
  });

  it('parses ac.voltage, ac.current, and ac.frequency path keys', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i1.ac.voltage', 120),
      makeUpdate('self.electrical.inverters.i1.ac.current', 8),
      makeUpdate('self.electrical.inverters.i1.ac.frequency', 60)
    ]);

    const map = (component as unknown as { invertersByKey: () => Record<string, { acVoltage?: number | null; acCurrent?: number | null; acFrequency?: number | null }> }).invertersByKey();
    expect(map['i1']?.acVoltage).toBe(120);
    expect(map['i1']?.acCurrent).toBe(8);
    expect(map['i1']?.acFrequency).toBe(60);
  });

  it('derives dcPower from dcVoltage * dcCurrent', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.voltage', 48));
    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.current', 10));
    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { invertersByKey: () => Record<string, { dcPower?: number | null }> }).invertersByKey();
    expect(map['i1']?.dcPower).toBe(480);
  });

  it('flushes the first live inverter update immediately, then batches subsequent updates', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.voltage', 48));

    let visible = (component as unknown as { visibleInverters: () => { id: string; dcVoltage?: number | null; dcCurrent?: number | null }[] }).visibleInverters();
    expect(visible.map(item => item.id)).toEqual(['i1']);

    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.current', 10));

    await vi.advanceTimersByTimeAsync(499);
    visible = (component as unknown as { visibleInverters: () => { id: string; dcVoltage?: number | null; dcCurrent?: number | null }[] }).visibleInverters();
    expect(visible[0]).toMatchObject({ id: 'i1', dcVoltage: 48 });
    expect(visible[0]?.dcCurrent).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    visible = (component as unknown as { visibleInverters: () => { id: string; dcVoltage?: number | null; dcCurrent?: number | null; dcPower?: number | null }[] }).visibleInverters();
    expect(visible[0]).toMatchObject({ id: 'i1', dcVoltage: 48, dcCurrent: 10, dcPower: 480 });
  });

  it('renders after live data arrives once svg is initialized', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.inverters.i1.name', 'Main Inverter'));
    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.voltage', 48));
    liveSubject.next(makeUpdate('self.electrical.inverters.i1.dc.current', 10));

    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const visible = (component as unknown as { visibleInverters: () => { id: string; name?: string | null }[] }).visibleInverters();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: 'i1', name: 'Main Inverter' });
  });

  it('derives display colors from per-metric states', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i1.dc.voltage', 48, States.Warn),
      makeUpdate('self.electrical.inverters.i1.dc.current', 10, States.Alarm),
      makeUpdate('self.electrical.inverters.i1.temperature', 40, States.Normal)
    ]);

    const models = (component as unknown as {
      displayModels: () => Record<string, {
        stateBarColor: string;
        primaryMetricsTextColor: string;
        secondaryMetricsTextColor: string;
      }>;
    }).displayModels();

    expect(models['i1']?.stateBarColor).toBeTruthy();
    expect(models['i1']?.primaryMetricsTextColor).toBeTruthy();
    expect(models['i1']?.secondaryMetricsTextColor).toBeTruthy();
  });

  it('uses compact mode metrics when display mode is compact', async () => {
    await setup(
      [
        makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
        makeUpdate('self.electrical.inverters.i1.dc.current', 10),
        makeUpdate('self.electrical.inverters.i1.ac.voltage', 120),
        makeUpdate('self.electrical.inverters.i1.ac.frequency', 60)
      ],
      {
        inverter: {
          trackedDevices: [{ id: 'i1', source: 'default', key: 'i1||default' }],
          cardMode: {
            displayMode: 'compact',
            metrics: ['dcVoltage', 'acVoltage']
          }
        }
      }
    );

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    expect(models['i1||default']?.metricsLineOne).toContain('DC V ');
    expect(models['i1||default']?.metricsLineOne).toContain('AC V ');
  });

  it('does not create a snapshot for unrecognized path keys', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i9.customMetric', 12)
    ]);

    const map = (component as unknown as { invertersByKey: () => Record<string, unknown> }).invertersByKey();
    expect(map['i9']).toBeUndefined();
  });

  it('materializes separate cards for same id across different sources', async () => {
    await setup(
      [
        makeUpdate('self.electrical.inverters.i1.dc.voltage', 48),
        makeUpdate('self.electrical.inverters.i1.dc.current', 10)
      ],
      {
        inverter: {
          trackedDevices: [
            { id: 'i1', source: 'sourceA', key: 'i1||sourceA' },
            { id: 'i1', source: 'sourceB', key: 'i1||sourceB' }
          ]
        }
      }
    );

    const visible = (component as unknown as { visibleInverters: () => { id: string; source?: string | null; deviceKey?: string }[] }).visibleInverters();
    expect(visible).toHaveLength(2);
    expect(visible.find(v => v.deviceKey === 'i1||sourceA')).toBeDefined();
    expect(visible.find(v => v.deviceKey === 'i1||sourceB')).toBeDefined();

    const models = (component as unknown as { displayModels: () => Record<string, { busText: string }> }).displayModels();
    expect(models['i1||sourceA']?.busText).toBe('sourceA');
    expect(models['i1||sourceB']?.busText).toBe('sourceB');
  });

  it('does not create a snapshot from root-node paths (no key segment after id)', async () => {
    await setup([
      makeUpdate('self.electrical.inverters.i7', { name: 'Main Inverter' })
    ]);

    const visible = (component as unknown as { visibleInverters: () => { id: string }[] }).visibleInverters();
    expect(visible.length).toBe(0);
  });

  it('supports legacy singular inverter metric paths', async () => {
    await setup([
      makeUpdate('self.electrical.inverter.i7.dc.voltage', 49),
      makeUpdate('self.electrical.inverter.i7.dc.current', 8)
    ]);

    const map = (component as unknown as { invertersByKey: () => Record<string, { dcVoltage?: number | null; dcCurrent?: number | null; dcPower?: number | null }> }).invertersByKey();
    expect(map['i7']?.dcVoltage).toBe(49);
    expect(map['i7']?.dcCurrent).toBe(8);
    expect(map['i7']?.dcPower).toBe(392);
  });

  it('supports legacy singular inverter root-node instance updates', async () => {
    await setup([
      makeUpdate('self.electrical.inverter.i8', { name: 'Legacy Inverter' })
    ]);

    const visible = (component as unknown as { visibleInverters: () => { id: string }[] }).visibleInverters();
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe('i8');
  });

  it('does not process paths with wrong family prefix', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.dc.voltage', 48)
    ]);

    const map = (component as unknown as { invertersByKey: () => Record<string, unknown> }).invertersByKey();
    expect(map['c1']).toBeUndefined();
  });
});
