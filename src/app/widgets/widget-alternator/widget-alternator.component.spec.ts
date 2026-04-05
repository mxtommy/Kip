import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetAlternatorComponent } from './widget-alternator.component';
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

describe('WidgetAlternatorComponent', () => {
  let fixture: ComponentFixture<WidgetAlternatorComponent>;
  let component: WidgetAlternatorComponent;
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
      imports: [WidgetAlternatorComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetAlternatorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-alternator-1');
    fixture.componentRef.setInput('type', 'widget-alternator');
    fixture.componentRef.setInput('theme', themeMock);
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('subscribes to the alternator path tree', async () => {
    await setup();
    const descriptor = getElectricalWidgetFamilyDescriptor('widget-alternator');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith(`${descriptor?.selfRootPath}.*`);
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledTimes(1);
  });

  it('does not process non-self electrical alternator prefix', async () => {
    await setup([
      makeUpdate('electrical.alternators.a1.voltage', 14.2)
    ]);

    const visible = (component as unknown as { visibleAlternatorKeys: () => string[] }).visibleAlternatorKeys();
    expect(visible).toEqual([]);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, { voltage?: number | null }> }).alternatorsByKey();
    expect(map.a1).toBeUndefined();
  });



  it('filters visible alternators by trackedDevices', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a2.voltage', 14.1)
      ],
      { alternator: { trackedDevices: [{ id: 'a1', source: 'default', key: 'a1||default' }] } }
    );

    const visible = (component as unknown as { visibleAlternatorKeys: () => string[] }).visibleAlternatorKeys();
    expect(visible).toEqual(['a1||default']);
  });

  it('shows all discovered alternators when no trackedDevices are configured', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
      makeUpdate('self.electrical.alternators.a2.voltage', 14.1)
    ]);

    const visible = (component as unknown as { visibleAlternators: () => { id: string }[] }).visibleAlternators();
    expect(visible.map(v => v.id).sort()).toEqual(['a1', 'a2']);
  });

  it('falls back to showing all alternators when trackedDevices is cleared after being set', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a2.voltage', 14.1)
      ],
      { alternator: { trackedDevices: [{ id: 'a1', source: 'default', key: 'a1||default' }] } }
    );

    let visible = (component as unknown as { visibleAlternators: () => { id: string }[] }).visibleAlternators();
    expect(visible.map(v => v.id)).toEqual(['a1']);

    runtimeMock.options.mockReturnValue({ alternator: { trackedDevices: [] } });
    (component as unknown as { applyConfig: (cfg: unknown) => void }).applyConfig(
      { alternator: { trackedDevices: [] } }
    );

    visible = (component as unknown as { visibleAlternators: () => { id: string }[] }).visibleAlternators();
    expect(visible.map(v => v.id).sort()).toEqual(['a1', 'a2']);
  });

  it('materializes separate cards for same id across different sources', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a1.current', 45)
      ],
      {
        alternator: {
          trackedDevices: [
            { id: 'a1', source: 'sourceA', key: 'a1||sourceA' },
            { id: 'a1', source: 'sourceB', key: 'a1||sourceB' }
          ]
        }
      }
    );

    const visible = (component as unknown as { visibleAlternators: () => { id: string; source?: string | null; deviceKey?: string }[] }).visibleAlternators();
    expect(visible).toHaveLength(2);
    expect(visible.find(v => v.deviceKey === 'a1||sourceA')).toBeDefined();
    expect(visible.find(v => v.deviceKey === 'a1||sourceB')).toBeDefined();

    const models = (component as unknown as { displayModels: () => Record<string, { busText: string }> }).displayModels();
    expect(models['a1||sourceA']?.busText).toBe('sourceA');
    expect(models['a1||sourceB']?.busText).toBe('sourceB');
  });

  it('parses alternator voltage and current keys', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
      makeUpdate('self.electrical.alternators.a1.current', 45)
    ]);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, { voltage?: number | null; current?: number | null }> }).alternatorsByKey();
    expect(map.a1?.voltage).toBe(14.2);
    expect(map.a1?.current).toBe(45);
  });

  it('derives power from voltage and current', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.alternators.a1.voltage', 14.2));
    liveSubject.next(makeUpdate('self.electrical.alternators.a1.current', 45));
    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, { power?: number | null }> }).alternatorsByKey();
    expect(map.a1?.power).toBeCloseTo(639);
  });

  it('captures revolutions and fieldDrive', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.revolutions', 50),
      makeUpdate('self.electrical.alternators.a1.fieldDrive', 63)
    ]);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, { revolutions?: number | null; fieldDrive?: number | null }> }).alternatorsByKey();
    expect(map.a1?.revolutions).toBe(50);
    expect(map.a1?.fieldDrive).toBe(63);
  });

  it('batches live updates after the first flush', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.alternators.a1.voltage', 14.2));
    let visible = (component as unknown as { visibleAlternators: () => { id: string; voltage?: number | null; current?: number | null }[] }).visibleAlternators();
    expect(visible[0]).toMatchObject({ id: 'a1', voltage: 14.2 });

    liveSubject.next(makeUpdate('self.electrical.alternators.a1.current', 45));
    await vi.advanceTimersByTimeAsync(499);
    visible = (component as unknown as { visibleAlternators: () => { id: string; voltage?: number | null; current?: number | null }[] }).visibleAlternators();
    expect(visible[0]?.current).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    visible = (component as unknown as { visibleAlternators: () => { id: string; current?: number | null }[] }).visibleAlternators();
    expect(visible[0]?.current).toBe(45);
  });

  it('renders after live data arrives once svg is initialized', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.alternators.a1.name', 'Main Alternator'));
    liveSubject.next(makeUpdate('self.electrical.alternators.a1.voltage', 14.2));
    liveSubject.next(makeUpdate('self.electrical.alternators.a1.current', 45));

    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const visible = (component as unknown as { visibleAlternators: () => { id: string; name?: string | null }[] }).visibleAlternators();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: 'a1', name: 'Main Alternator' });
  });

  it('uses compact mode metrics when display mode is compact', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a1.current', 45),
        makeUpdate('self.electrical.alternators.a1.revolutions', 50),
        makeUpdate('self.electrical.alternators.a1.fieldDrive', 63)
      ],
      {
        alternator: {
          trackedDevices: [{ id: 'a1', source: 'default', key: 'a1||default' }],
          cardMode: {
            displayMode: 'compact',
            metrics: ['voltage', 'revolutions', 'fieldDrive']
          }
        }
      }
    );

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    const metricText = `${models['a1||default']?.metricsLineOne ?? ''} ${models['a1||default']?.metricsLineTwo ?? ''}`;
    expect(metricText).toContain('V ');
    expect(metricText).toContain('RPM ');
    expect(metricText).toContain('FD ');
  });

  it('uses compact mode when displayMode is compact', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a1.revolutions', 50)
      ],
      {
        alternator: {
          trackedDevices: [{ id: 'a1', source: 'default', key: 'a1||default' }],
          cardMode: {
            displayMode: 'compact',
            metrics: ['voltage', 'revolutions']
          }
        }
      }
    );

    const compact = (component as unknown as { isCompactCardMode: () => boolean }).isCompactCardMode();
    expect(compact).toBe(true);
  });

  it('does not create a snapshot for unrecognized path keys', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.customMetric', 12)
    ]);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, unknown> }).alternatorsByKey();
    expect(map.a1).toBeUndefined();
  });

  it('does not process paths with wrong family prefix', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.voltage', 14.2)
    ]);

    const map = (component as unknown as { alternatorsByKey: () => Record<string, unknown> }).alternatorsByKey();
    expect(map.c1).toBeUndefined();
  });
});
