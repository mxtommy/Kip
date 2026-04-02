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
    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.alternator.*');
  });

  it('does not process non-self electrical alternator prefix', async () => {
    await setup([
      makeUpdate('electrical.alternators.a1.voltage', 14.2)
    ]);

    const visible = (component as unknown as { visibleAlternatorIds: () => string[] }).visibleAlternatorIds();
    expect(visible).toEqual([]);

    const map = (component as unknown as { alternatorsById: () => Record<string, { voltage?: number | null }> }).alternatorsById();
    expect(map.a1).toBeUndefined();
  });

  it('discovers alternator instance from singular root object path', async () => {
    await setup([
      makeUpdate('self.electrical.alternator.0', { state: 'present' })
    ]);

    const visible = (component as unknown as { visibleAlternatorIds: () => string[] }).visibleAlternatorIds();
    expect(visible).toEqual(['0']);

    const map = (component as unknown as { alternatorsById: () => Record<string, { id: string; voltage?: number | null }> }).alternatorsById();
    expect(map['0']?.id).toBe('0');
  });

  it('parses singular alternator root metric paths', async () => {
    await setup([
      makeUpdate('self.electrical.alternator.0.voltage', 14.2),
      makeUpdate('self.electrical.alternator.0.current', 45)
    ]);

    const map = (component as unknown as { alternatorsById: () => Record<string, { voltage?: number | null; current?: number | null }> }).alternatorsById();
    expect(map['0']?.voltage).toBe(14.2);
    expect(map['0']?.current).toBe(45);
  });


  it('filters visible alternators by trackedIds', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a2.voltage', 14.4)
      ],
      { alternator: { trackedIds: ['a1'] } }
    );

    const visible = (component as unknown as { visibleAlternatorIds: () => string[] }).visibleAlternatorIds();
    expect(visible).toEqual(['a1']);
  });

  it('parses alternator voltage and current keys', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
      makeUpdate('self.electrical.alternators.a1.current', 45)
    ]);

    const map = (component as unknown as { alternatorsById: () => Record<string, { voltage?: number | null; current?: number | null }> }).alternatorsById();
    expect(map.a1?.voltage).toBe(14.2);
    expect(map.a1?.current).toBe(45);
  });

  it('derives power from voltage and current', async () => {
    vi.useFakeTimers();
    await setup();

    liveSubject.next(makeUpdate('self.electrical.alternators.a1.voltage', 14.2));
    liveSubject.next(makeUpdate('self.electrical.alternators.a1.current', 45));
    await vi.advanceTimersByTimeAsync(500);

    const map = (component as unknown as { alternatorsById: () => Record<string, { power?: number | null }> }).alternatorsById();
    expect(map.a1?.power).toBeCloseTo(639);
  });

  it('captures revolutions and fieldDrive', async () => {
    await setup([
      makeUpdate('self.electrical.alternators.a1.revolutions', 50),
      makeUpdate('self.electrical.alternators.a1.fieldDrive', 63)
    ]);

    const map = (component as unknown as { alternatorsById: () => Record<string, { revolutions?: number | null; fieldDrive?: number | null }> }).alternatorsById();
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

  it('uses card mode metrics when display mode is card', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a1.current', 45),
        makeUpdate('self.electrical.alternators.a1.revolutions', 50),
        makeUpdate('self.electrical.alternators.a1.fieldDrive', 63)
      ],
      {
        alternator: {
          trackedIds: ['a1'],
          cardMode: {
            enabled: true,
            displayMode: 'card',
            metrics: ['voltage', 'revolutions', 'fieldDrive']
          }
        }
      }
    );

    const models = (component as unknown as { displayModels: () => Record<string, { metricsLineOne: string; metricsLineTwo: string }> }).displayModels();
    const metricText = `${models.a1?.metricsLineOne ?? ''} ${models.a1?.metricsLineTwo ?? ''}`;
    expect(metricText).toContain('V ');
    expect(metricText).toContain('RPM ');
    expect(metricText).toContain('FD ');
  });

  it('enables card mode by default when cardMode omits enabled', async () => {
    await setup(
      [
        makeUpdate('self.electrical.alternators.a1.voltage', 14.2),
        makeUpdate('self.electrical.alternators.a1.revolutions', 50)
      ],
      {
        alternator: {
          trackedIds: ['a1'],
          cardMode: {
            displayMode: 'card',
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

    const map = (component as unknown as { alternatorsById: () => Record<string, unknown> }).alternatorsById();
    expect(map.a1).toBeUndefined();
  });

  it('does not process paths with wrong family prefix', async () => {
    await setup([
      makeUpdate('self.electrical.chargers.c1.voltage', 14.2)
    ]);

    const map = (component as unknown as { alternatorsById: () => Record<string, unknown> }).alternatorsById();
    expect(map.c1).toBeUndefined();
  });
});
