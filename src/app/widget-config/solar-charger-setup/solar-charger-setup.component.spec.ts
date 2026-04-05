import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, FormGroupDirective } from '@angular/forms';
import { Subject } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SolarChargerSetupComponent } from './solar-charger-setup.component';
import { PathDiscoveryService } from '../../core/services/path-discovery.service';
import { DataService } from '../../core/services/data.service';

describe('SolarChargerSetupComponent', () => {
  let fixture: ComponentFixture<SolarChargerSetupComponent>;
  let component: SolarChargerSetupComponent;
  let changes$: Subject<void>;

  const formGroup = new UntypedFormGroup({
    solarCharger: new UntypedFormGroup({
      trackedDevices: new UntypedFormControl([]),
      groups: new UntypedFormControl([]),
      optionsById: new UntypedFormGroup({})
    })
  });

  const discoveryMock = {
    register: vi.fn(() => 'solar-token'),
    unregister: vi.fn(),
    activePaths: vi.fn(() => new Set<string>([
      'self.electrical.solar.sc1.voltage',
      'self.electrical.solar.sc2.voltage'
    ])),
    changes: vi.fn(() => changes$.asObservable())
  };

  const dataMock = {
    getCachedPaths: vi.fn(() => []),
    getPathObject: vi.fn((path: string): { sources: Record<string, unknown> } => {
      if (path.includes('sc1')) {
        return { sources: { sourceA: {}, sourceB: {} } };
      }

      return { sources: { default: {} } };
    })
  };

  beforeEach(async () => {
    changes$ = new Subject<void>();
    formGroup.setControl('solarCharger', new UntypedFormGroup({
      trackedDevices: new UntypedFormControl([]),
      groups: new UntypedFormControl([]),
      optionsById: new UntypedFormGroup({})
    }));

    await TestBed.configureTestingModule({
      imports: [SolarChargerSetupComponent],
      providers: [
        { provide: FormGroupDirective, useValue: { control: formGroup } },
        { provide: PathDiscoveryService, useValue: discoveryMock },
        { provide: DataService, useValue: dataMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SolarChargerSetupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('formGroupName', 'solarCharger');
    fixture.detectChanges();
  });

  it('shows all discovered option ids when no tracked devices are selected', () => {
    const optionIds = (component as unknown as { optionIds: () => string[] }).optionIds();
    expect(optionIds).toEqual(['sc1', 'sc2']);
  });

  it('limits option ids to selected tracked device ids when tracked devices are chosen', () => {
    const trackedControl = formGroup.get('solarCharger.trackedDevices') as UntypedFormControl;
    trackedControl.setValue([
      { id: 'sc1', source: 'sourceA', key: 'sc1||sourceA' },
      { id: 'sc1', source: 'sourceB', key: 'sc1||sourceB' }
    ]);
    fixture.detectChanges();

    const optionIds = (component as unknown as { optionIds: () => string[] }).optionIds();
    expect(optionIds).toEqual(['sc1']);
  });

  it('requires only visible option controls when tracked devices are selected', () => {
    const optionsGroup = formGroup.get('solarCharger.optionsById') as UntypedFormGroup;
    const trackedControl = formGroup.get('solarCharger.trackedDevices') as UntypedFormControl;

    trackedControl.setValue([{ id: 'sc1', source: 'sourceA', key: 'sc1||sourceA' }]);
    fixture.detectChanges();

    const sc1Control = optionsGroup.get('sc1.arrayRatedPowerW') as UntypedFormControl;
    const sc2Control = optionsGroup.get('sc2.arrayRatedPowerW') as UntypedFormControl;

    expect(sc1Control.enabled).toBe(true);
    expect(sc1Control.hasError('required')).toBe(true);
    expect(sc2Control.disabled).toBe(true);

    sc1Control.setValue(800);
    fixture.detectChanges();

    expect((formGroup.get('solarCharger') as UntypedFormGroup).valid).toBe(true);
  });

  it('requires all discovered option controls when no tracked devices are selected', () => {
    const optionsGroup = formGroup.get('solarCharger.optionsById') as UntypedFormGroup;

    fixture.detectChanges();

    const sc1Control = optionsGroup.get('sc1.arrayRatedPowerW') as UntypedFormControl;
    const sc2Control = optionsGroup.get('sc2.arrayRatedPowerW') as UntypedFormControl;

    expect(sc1Control.enabled).toBe(true);
    expect(sc2Control.enabled).toBe(true);
    expect(sc1Control.hasError('required')).toBe(true);
    expect(sc2Control.hasError('required')).toBe(true);

    sc1Control.setValue(800);
    sc2Control.setValue(900);
    fixture.detectChanges();

    expect((formGroup.get('solarCharger') as UntypedFormGroup).valid).toBe(true);
  });

  it('does not throw on init when reopening with saved tracked devices', async () => {
    formGroup.setControl('solarCharger', new UntypedFormGroup({
      trackedDevices: new UntypedFormControl([
        { id: 'sc1', source: 'sourceA', key: 'sc1||sourceA' }
      ]),
      groups: new UntypedFormControl([]),
      optionsById: new UntypedFormGroup({})
    }));

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SolarChargerSetupComponent],
      providers: [
        { provide: FormGroupDirective, useValue: { control: formGroup } },
        { provide: PathDiscoveryService, useValue: discoveryMock },
        { provide: DataService, useValue: dataMock }
      ]
    }).compileComponents();

    const reopenedFixture = TestBed.createComponent(SolarChargerSetupComponent);
    reopenedFixture.componentRef.setInput('formGroupName', 'solarCharger');

    expect(() => reopenedFixture.detectChanges()).not.toThrow();
  });

  it('discovers positional ids from root-only solar paths', () => {
    discoveryMock.activePaths.mockReturnValue(new Set<string>([
      'self.electrical.solar.power',
      'self.electrical.solar.charge'
    ]));
    dataMock.getPathObject.mockImplementation((path: string) => {
      if (path.endsWith('.power')) {
        return { sources: { sourceA: {} } };
      }

      if (path.endsWith('.charge')) {
        return { sources: { sourceB: {} } };
      }

      return { sources: { default: {} } };
    });

    changes$.next();
    fixture.detectChanges();

    const discoveredIds = (component as unknown as { discoveredSolarIds: () => string[] }).discoveredSolarIds();
    const discoveredDevices = (component as unknown as {
      discoveredTrackedDevices: () => { key: string }[];
    }).discoveredTrackedDevices();

    expect(discoveredIds).toEqual(['charge', 'power']);
    expect(discoveredDevices.map(device => device.key)).toEqual(['charge||sourceB', 'power||sourceA']);
  });

  it('discovers positional ids from metric-bearing paths', () => {
    discoveryMock.activePaths.mockReturnValue(new Set<string>([
      'self.electrical.solar.controller.temperature',
      'self.electrical.solar.load.current'
    ]));
    dataMock.getPathObject.mockImplementation((path: string) => {
      if (path.includes('.controller.')) {
        return { sources: { sourceA: {} } };
      }

      if (path.includes('.load.')) {
        return { sources: { sourceB: {} } };
      }

      return { sources: { default: {} } };
    });

    changes$.next();
    fixture.detectChanges();

    const discoveredIds = (component as unknown as { discoveredSolarIds: () => string[] }).discoveredSolarIds();
    const discoveredDevices = (component as unknown as {
      discoveredTrackedDevices: () => { key: string }[];
    }).discoveredTrackedDevices();

    expect(discoveredIds).toEqual(['controller', 'load']);
    expect(discoveredDevices.map(device => device.key)).toEqual(['controller||sourceA', 'load||sourceB']);
  });

  it('does not add default when the same discovered id already has an explicit source', () => {
    discoveryMock.activePaths.mockReturnValue(new Set<string>([
      'self.electrical.solar.bimini',
      'self.electrical.solar.bimini.current'
    ]));
    dataMock.getPathObject.mockImplementation((path: string) => {
      if (path.endsWith('.current')) {
        return { sources: { 'Renogy Rover Client': {} } };
      }

      return { sources: {} };
    });

    changes$.next();
    fixture.detectChanges();

    const discoveredDevices = (component as unknown as {
      discoveredTrackedDevices: () => { key: string }[];
    }).discoveredTrackedDevices();

    expect(discoveredDevices.map(device => device.key)).toEqual(['bimini||Renogy Rover Client']);
  });
});
