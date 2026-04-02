import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetAcComponent } from './widget-ac.component';
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

describe('WidgetAcComponent', () => {
  let fixture: ComponentFixture<WidgetAcComponent>;
  let component: WidgetAcComponent;
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
      imports: [WidgetAcComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetAcComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-ac-1');
    fixture.componentRef.setInput('type', 'widget-ac');
    fixture.componentRef.setInput('theme', themeMock);
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('subscribes to the ac path tree', async () => {
    await setup();
    const descriptor = getElectricalWidgetFamilyDescriptor('widget-ac');
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith(`${descriptor?.selfRootPath}.*`);
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('electrical.ac.*');
  });

  it('filters visible buses by trackedIds', async () => {
    await setup(
      [
        makeUpdate('self.electrical.ac.bus1.line1.voltage', 120),
        makeUpdate('self.electrical.ac.bus2.line1.voltage', 121)
      ],
      { ac: { trackedIds: ['bus1'] } }
    );

    const visible = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visible).toEqual(['bus1']);
  });

  it('uses configured trackedIds even when they are missing from discovered ids', async () => {
    await setup(
      [
        makeUpdate('self.electrical.ac.0.voltage', 230),
        makeUpdate('self.electrical.ac.1.current', 4.5)
      ],
      { ac: { trackedIds: ['bus9'] } }
    );

    const visible = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visible).toEqual(['bus9']);
  });

  it('ignores reserved aggregate ids in trackedIds', async () => {
    await setup(
      [
        makeUpdate('electrical.ac.outletA.phase.A.current', 3.4)
      ],
      { ac: { trackedIds: ['totalCurrent', 'totalPower', 'outletA'] } }
    );

    const visible = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visible).toEqual(['outletA']);
  });

  it('parses line voltage/current/frequency keys', async () => {
    await setup([
      makeUpdate('self.electrical.ac.bus1.line1.voltage', 120),
      makeUpdate('self.electrical.ac.bus1.line1.current', 10),
      makeUpdate('self.electrical.ac.bus1.line1.frequency', 60)
    ]);

    const map = (component as unknown as {
      busesById: () => Record<string, { line1Voltage?: number | null; line1Current?: number | null; line1Frequency?: number | null }>;
    }).busesById();

    expect(map.bus1?.line1Voltage).toBe(120);
    expect(map.bus1?.line1Current).toBe(10);
    expect(map.bus1?.line1Frequency).toBe(60);
  });

  it('supports flat ac paths for numeric ids', async () => {
    await setup([
      makeUpdate('self.electrical.ac.0.voltage', 230),
      makeUpdate('self.electrical.ac.0.current', 4.2),
      makeUpdate('self.electrical.ac.1.voltage', 231),
      makeUpdate('self.electrical.ac.1.frequency', 50)
    ]);

    const map = (component as unknown as {
      busesById: () => Record<string, { line1Voltage?: number | null; line1Current?: number | null; line1Frequency?: number | null }>;
    }).busesById();

    expect(map['0']?.line1Voltage).toBe(230);
    expect(map['0']?.line1Current).toBe(4.2);
    expect(map['1']?.line1Voltage).toBe(231);
    expect(map['1']?.line1Frequency).toBe(50);

    const visibleIds = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visibleIds).toEqual(['0', '1']);
  });

  it('processes non-self electrical ac prefix', async () => {
    await setup([
      makeUpdate('electrical.ac.0.voltage', 230),
      makeUpdate('electrical.ac.1.current', 4.5)
    ]);

    const map = (component as unknown as {
      busesById: () => Record<string, { line1Voltage?: number | null; line1Current?: number | null }>;
    }).busesById();

    expect(map['0']?.line1Voltage).toBe(230);
    expect(map['1']?.line1Current).toBe(4.5);

    const visibleIds = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visibleIds).toEqual(['0', '1']);
  });

  it('maps phase schema metrics into line metrics', async () => {
    await setup([
      makeUpdate('electrical.ac.outletA.phase.A.lineNeutralVoltage', 229.8),
      makeUpdate('electrical.ac.outletA.phase.A.current', 3.2),
      makeUpdate('electrical.ac.outletA.phase.A.frequency', 50.1),
      makeUpdate('electrical.ac.outletA.phase.B.current', 1.5),
      makeUpdate('electrical.ac.outletA.phase.C.current', 2.5)
    ]);

    const map = (component as unknown as {
      busesById: () => Record<string, { line1Voltage?: number | null; line1Current?: number | null; line1Frequency?: number | null; line2Current?: number | null; line3Current?: number | null }>;
    }).busesById();

    expect(map.outletA?.line1Voltage).toBe(229.8);
    expect(map.outletA?.line1Current).toBe(3.2);
    expect(map.outletA?.line1Frequency).toBe(50.1);
    expect(map.outletA?.line2Current).toBe(1.5);
    expect(map.outletA?.line3Current).toBe(2.5);
  });

  it('keeps a bus visible when unsupported AC child paths are present', async () => {
    await setup([
      makeUpdate('electrical.ac.outletA.phase.neutral.current', 3.2),
      makeUpdate('electrical.ac.outletA.metadata.vendorName', 'Victron')
    ]);

    const visibleIds = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visibleIds).toEqual(['outletA']);

    const visibleBuses = (component as unknown as {
      visibleBuses: () => Array<{ id: string; line1Current?: number | null }>;
    }).visibleBuses();

    expect(visibleBuses).toHaveLength(1);
    expect(visibleBuses[0]?.id).toBe('outletA');
    expect(visibleBuses[0]?.line1Current).toBeUndefined();
  });

  it('discovers a bus from per-plug total paths even without phase metrics', async () => {
    await setup([
      makeUpdate('electrical.ac.outletA.total.realPower', 720)
    ]);

    const visibleIds = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visibleIds).toEqual(['outletA']);

    const visibleBuses = (component as unknown as {
      visibleBuses: () => Array<{ id: string; power?: number | null }>;
    }).visibleBuses();

    expect(visibleBuses).toHaveLength(1);
    expect(visibleBuses[0]?.id).toBe('outletA');
    expect(visibleBuses[0]?.power).toBe(720);
  });

  it('tracks per-plug totals and ignores global totals paths', async () => {
    await setup([
      makeUpdate('electrical.ac.outletA.total.realPower', 720),
      makeUpdate('electrical.ac.totalCurrent', 15.3),
      makeUpdate('electrical.ac.totalPower', 2200)
    ]);

    const map = (component as unknown as { busesById: () => Record<string, { power?: number | null }> }).busesById();
    expect(map.outletA?.power).toBe(720);

    const visibleIds = (component as unknown as { visibleBusIds: () => string[] }).visibleBusIds();
    expect(visibleIds).toEqual(['outletA']);
  });

  it('batches live updates after the first flush', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line1.voltage', 120));
    const visible = (component as unknown as {
      visibleBuses: () => { id: string; line1Voltage?: number | null; line1Current?: number | null }[];
    }).visibleBuses();
    expect(visible[0]).toMatchObject({ id: 'bus1', line1Voltage: 120 });

    liveSubject.next(makeUpdate('self.electrical.ac.bus1.line1.current', 10));
    await vi.advanceTimersByTimeAsync(499);
    const visibleBeforeBatch = (component as unknown as {
      visibleBuses: () => { line1Current?: number | null }[];
    }).visibleBuses();
    expect(visibleBeforeBatch[0]?.line1Current).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    const visibleAfterBatch = (component as unknown as {
      visibleBuses: () => { line1Current?: number | null }[];
    }).visibleBuses();
    expect(visibleAfterBatch[0]?.line1Current).toBe(10);
  });

  it('uses card mode metrics when display mode is card', async () => {
    await setup(
      [
        makeUpdate('self.electrical.ac.bus1.line1.voltage', 120),
        makeUpdate('self.electrical.ac.bus1.line1.current', 10),
        makeUpdate('self.electrical.ac.bus1.line2.voltage', 121),
        makeUpdate('self.electrical.ac.bus1.line3.current', 9)
      ],
      {
        ac: {
          trackedIds: ['bus1'],
          cardMode: {
            enabled: true,
            displayMode: 'card',
            metrics: ['line1Voltage', 'line2Voltage', 'line3Current']
          }
        }
      }
    );

    const models = (component as unknown as {
      displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }>;
    }).displayModels();

    const metricText = `${models.bus1?.metricsLineOne ?? ''} ${models.bus1?.metricsLineTwo ?? ''}`;
    expect(metricText).toContain('L1V');
    expect(metricText).toContain('L2V');
    expect(metricText).toContain('L3A');
  });

  it('does not process paths with wrong family prefix', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.voltage', 28)
    ]);

    const map = (component as unknown as { busesById: () => Record<string, unknown> }).busesById();
    expect(map.c1).toBeUndefined();
  });
});
