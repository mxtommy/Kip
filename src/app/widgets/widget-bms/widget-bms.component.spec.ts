import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MatIconRegistry } from '@angular/material/icon';
import { WidgetBmsComponent } from './widget-bms.component';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { UnitsService } from '../../core/services/units.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import type { ITheme } from '../../core/services/app-service';

describe('WidgetBmsComponent', () => {
  let fixture: ComponentFixture<WidgetBmsComponent>;
  let component: WidgetBmsComponent;
  let liveSubject: Subject<IPathUpdateWithPath>;

  const dataServiceMock = {
    subscribePathTreeWithInitial: jasmine.createSpy('subscribePathTreeWithInitial')
  };

  const runtimeMock = {
    options: () => ({
      color: 'contrast',
      ignoreZones: false,
      bms: {
        trackedBatteryIds: [],
        banks: []
      }
    })
  };

  const unitsMock = {
    convertToUnit: (_unit: string, value: unknown) => value,
    getDefaults: () => ({ Temperature: 'celsius' })
  };

  const iconRegistryMock = {
    addSvgIconSetLiteral: () => iconRegistryMock,
    getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
  };

  const themeMock = {
    contrast: '#fff',
    dim: '#ccc',
    dimmer: '#999',
    zoneNominal: '#00ff00',
    zoneWarn: '#ffaa00',
    zoneAlarm: '#ff0000',
    zoneAlert: '#ff00ff'
  } as unknown as ITheme;

  const makeUpdate = (path: string, value: number | string | null): IPathUpdateWithPath => ({
    path,
    update: {
      data: { value, timestamp: new Date('2026-01-01T00:00:00.000Z') },
      state: States.Normal
    }
  });

  beforeEach(async () => {
    liveSubject = new Subject<IPathUpdateWithPath>();

    dataServiceMock.subscribePathTreeWithInitial.and.returnValue({
      initial: [
        makeUpdate('self.electrical.batteries.bat1.voltage', 12.4),
        makeUpdate('self.electrical.batteries.bat2.voltage', 12.6)
      ],
      live$: liveSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [WidgetBmsComponent],
      providers: [
        { provide: DataService, useValue: dataServiceMock },
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: UnitsService, useValue: unitsMock },
        { provide: MatIconRegistry, useValue: iconRegistryMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetBmsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-bms-1');
    fixture.componentRef.setInput('type', 'widget-bms');
    fixture.componentRef.setInput('theme', themeMock);
  });

  it('flushes all initial cached paths once, then batches live updates', fakeAsync(() => {
    fixture.detectChanges();

    expect(dataServiceMock.subscribePathTreeWithInitial).toHaveBeenCalledWith('self.electrical.batteries.*');
    expect((component as unknown as { discoveredBatteryIds: () => string[] }).discoveredBatteryIds()).toEqual(['bat1', 'bat2']);

    const flushSpy = spyOn(component as unknown as { flushPendingPathUpdates: () => void }, 'flushPendingPathUpdates').and.callThrough();

    flushSpy.calls.reset();

    liveSubject.next(makeUpdate('self.electrical.batteries.bat3.voltage', 12.7));

    expect(flushSpy).not.toHaveBeenCalled();
    tick(499);
    expect(flushSpy).not.toHaveBeenCalled();

    tick(1);
    expect(flushSpy.calls.count()).toBe(1);
    expect((component as unknown as { discoveredBatteryIds: () => string[] }).discoveredBatteryIds()).toEqual(['bat1', 'bat2', 'bat3']);
  }));
});
