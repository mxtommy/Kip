import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { WidgetSolarChargerComponent } from './widget-solar-charger.component';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import type { ITheme } from '../../core/services/app-service';

describe('WidgetSolarChargerComponent', () => {
  let fixture: ComponentFixture<WidgetSolarChargerComponent>;
  let component: WidgetSolarChargerComponent;
  let liveSubject: Subject<IPathUpdateWithPath>;

  let runtimeOptions: {
    color?: string;
    ignoreZones?: boolean;
    solarCharger?: {
      trackedSolarIds?: string[];
      solarOptionsById?: Record<string, { arrayRatedPowerW?: number | null }>;
    };
  };

  const dataServiceMock = {
    subscribePathTreeWithInitial: vi.fn()
  };

  const runtimeMock = {
    options: () => runtimeOptions
  };

  const unitsMock = {
    convertToUnit: (_unit: string, value: unknown) => value,
    getDefaults: () => ({ Temperature: 'celsius' })
  };

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

  beforeEach(async () => {
    liveSubject = new Subject<IPathUpdateWithPath>();
    runtimeOptions = {
      solarCharger: {
        trackedSolarIds: [],
        solarOptionsById: {}
      }
    };

    dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
      initial: [
        makeUpdate('self.electrical.solar.sc1.voltage', 14.2),
        makeUpdate('self.electrical.solar.sc2.voltage', 14.4)
      ],
      live$: liveSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [WidgetSolarChargerComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetSolarChargerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-solar-1');
    fixture.componentRef.setInput('type', 'widget-solar-charger');
    fixture.componentRef.setInput('theme', themeMock);
  });

  it('flushes all initial cached paths once, then batches live updates', async () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();

      expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.solar.*');
      expect((component as unknown as { discoveredSolarIds: () => string[] }).discoveredSolarIds()).toEqual(['sc1', 'sc2']);

      const flushSpy = vi.spyOn(component as unknown as { flushPendingPathUpdates: () => void }, 'flushPendingPathUpdates');
      flushSpy.mockClear();

      liveSubject.next(makeUpdate('self.electrical.solar.sc3.voltage', 14.5));

      expect(flushSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(499);
      expect(flushSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(vi.mocked(flushSpy).mock.calls.length).toBe(1);
      expect((component as unknown as { discoveredSolarIds: () => string[] }).discoveredSolarIds()).toEqual(['sc1', 'sc2', 'sc3']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses runtime-provided colorRole and ignoreZones values', () => {
    runtimeOptions.color = 'contrast';
    runtimeOptions.ignoreZones = false;
    fixture.detectChanges();

    const colorRole = (component as unknown as { colorRole: () => string }).colorRole();
    const ignoreZones = (component as unknown as { ignoreZones: () => boolean }).ignoreZones();

    expect(colorRole).toBe('contrast');
    expect(ignoreZones).toBe(false);
  });

  it('keeps zero numeric values visible and uses explicit relay visibility state', () => {
    dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
      initial: [
        makeUpdate('self.electrical.solar.sc1.controllerMode', 'bulk'),
        makeUpdate('self.electrical.solar.sc1.current', 0),
        makeUpdate('self.electrical.solar.sc1.voltage', 0),
        makeUpdate('self.electrical.solar.sc1.temperature', 0),
        makeUpdate('self.electrical.solar.sc1.panelVoltage', 0),
        makeUpdate('self.electrical.solar.sc1.panelCurrent', 0),
        makeUpdate('self.electrical.solar.sc1.panelTemperature', 0),
        makeUpdate('self.electrical.solar.sc1.load', false),
        makeUpdate('self.electrical.solar.sc1.loadCurrent', 0)
      ],
      live$: liveSubject.asObservable()
    });

    fixture = TestBed.createComponent(WidgetSolarChargerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-solar-2');
    fixture.componentRef.setInput('type', 'widget-solar-charger');
    fixture.componentRef.setInput('theme', themeMock);

    fixture.detectChanges();

    const model = (component as unknown as {
      displayModels: () => Record<string, {
        gaugeSectionText: string;
        chargerSectionMetadata: string;
        relaySectionVisible: boolean;
        relaySectionText: string;
      }>;
    }).displayModels().sc1;

    expect(model.gaugeSectionText).toContain('0.0V');
    expect(model.gaugeSectionText).toContain('0.0A');
    expect(model.gaugeSectionText).toContain('0.0 °C');
    expect(model.chargerSectionMetadata).toContain('0.0V');
    expect(model.chargerSectionMetadata).toContain('0.0 °C');
    expect(model.relaySectionVisible).toBe(false);
    expect(model.relaySectionText).toBe('');
  });

  it('uses panelPower state for panel color and charger current state for charger current text color', () => {
    runtimeOptions.color = 'contrast';
    runtimeOptions.ignoreZones = false;

    dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
      initial: [
        makeUpdate('self.electrical.solar.sc1.controllerMode', 'bulk'),
        makeUpdate('self.electrical.solar.sc1.panelPower', 1200, States.Alarm),
        makeUpdate('self.electrical.solar.sc1.panelCurrent', 18, States.Warn),
        makeUpdate('self.electrical.solar.sc1.current', 30, States.Nominal)
      ],
      live$: liveSubject.asObservable()
    });

    fixture = TestBed.createComponent(WidgetSolarChargerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-solar-4');
    fixture.componentRef.setInput('type', 'widget-solar-charger');
    fixture.componentRef.setInput('theme', themeMock);

    fixture.detectChanges();

    const model = (component as unknown as {
      displayModels: () => Record<string, {
        panelPowerColor: string;
        chargerCurrentTextColor: string;
      }>;
    }).displayModels().sc1;

    expect(model.panelPowerColor).toBe(themeMock.zoneAlarm);
    expect(model.chargerCurrentTextColor).toBe(themeMock.zoneNominal);
  });

  it('keeps solar panel power tspans stable across renders', () => {
    runtimeOptions.color = 'contrast';
    runtimeOptions.ignoreZones = false;

    dataServiceMock.subscribePathTreeWithInitial.mockReturnValue({
      initial: [
        makeUpdate('self.electrical.solar.sc1.panelPower', 1250),
        makeUpdate('self.electrical.solar.sc1.controllerMode', 'bulk')
      ],
      live$: liveSubject.asObservable()
    });

    fixture = TestBed.createComponent(WidgetSolarChargerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-solar-3');
    fixture.componentRef.setInput('type', 'widget-solar-charger');
    fixture.componentRef.setInput('theme', themeMock);

    fixture.detectChanges();

    const testApi = component as unknown as {
      buildRenderSnapshot: () => unknown;
      render: (snapshot: unknown) => void;
    };

    const initialSnapshot = testApi.buildRenderSnapshot();
    expect(initialSnapshot).toBeTruthy();

    testApi.render(initialSnapshot);
    testApi.render(initialSnapshot);

    const element = fixture.nativeElement as HTMLElement;
    const tspans = element.querySelectorAll('text.solar-panel-power tspan');
    expect(tspans.length).toBe(2);
  });
});
