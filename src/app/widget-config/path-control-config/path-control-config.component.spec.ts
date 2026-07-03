import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { IDynamicControl } from '../../core/interfaces/widgets-interface';

import { PathControlConfigComponent } from './path-control-config.component';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { DataService } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';

describe('PathControlConfigComponent', () => {
  let component: PathControlConfigComponent;
  let fixture: ComponentFixture<PathControlConfigComponent>;
  const mockUnitsService = {
    skBaseUnits: [
      { unit: 'rad', properties: { display: '°', quantity: 'Angle', quantityDisplay: '∠', description: 'Radians' } },
      { unit: 'deg', properties: { display: 'Position', quantity: 'Angle', quantityDisplay: '∠', description: 'Position degrees' } }
    ],
    getConversions: () => [],
    getConversionsForPath: () => ({ base: 'deg', conversions: [] })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathControlConfigComponent],
      providers: [
        {
          // Real AuthenticationService/StorageService get pulled in via the DI HTTP interceptor and
          // subscribe to these streams, so mirror the global connection stub (plus skServerVersion).
          provide: SignalKConnectionService,
          useValue: {
            skServerVersion: '2.14.0',
            serverServiceEndpoint$: new BehaviorSubject({ operation: 0, httpServiceUrl: '', WsServiceUrl: '', subscribeAll: false }),
            serverVersion$: new BehaviorSubject(null),
            signalKURL: { url: 'http://localhost' },
            getServiceEndpointStatusAsO(): unknown { return this.serverServiceEndpoint$.asObservable(); }
          }
        },
        {
          provide: DataService,
          useValue: {
            getPathObject: () => ({ displayName: 'Speed', meta: { units: 'knots' } }),
            getPathsAndMetaByType: () => ([])
          }
        },
        { provide: UnitsService, useValue: mockUnitsService }
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PathControlConfigComponent);
    component = fixture.componentInstance;
    // Provide required inputs before first detectChanges
    const pathForm = new UntypedFormGroup({
      description: new UntypedFormControl('Speed'),
      path: new UntypedFormControl('navigation.speedThroughWater'),
      pathID: new UntypedFormControl('uuid-1'),
      source: new UntypedFormControl('default'),
      pathType: new UntypedFormControl('number'),
      supportsPut: new UntypedFormControl(true),
      isPathConfigurable: new UntypedFormControl(true),
      showPathSkUnitsFilter: new UntypedFormControl(false),
      pathSkUnitsFilter: new UntypedFormControl(null),
      convertUnitTo: new UntypedFormControl('knots'),
      sampleTime: new UntypedFormControl(500),
      pathRequired: new UntypedFormControl(true)
    });
    fixture.componentRef.setInput('pathFormGroup', pathForm);
    fixture.componentRef.setInput('multiCTRLArray', [] as IDynamicControl[]);
    fixture.componentRef.setInput('filterSelfPaths', false);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should build a stable unit filter list without mutating base units', () => {
    const baseUnitsSnapshot = structuredClone(mockUnitsService.skBaseUnits);
    const filterPathForm = new UntypedFormGroup({
      description: new UntypedFormControl('Position'),
      path: new UntypedFormControl('navigation.position'),
      pathID: new UntypedFormControl('uuid-2'),
      source: new UntypedFormControl('default'),
      pathType: new UntypedFormControl('number'),
      supportsPut: new UntypedFormControl(true),
      isPathConfigurable: new UntypedFormControl(true),
      showPathSkUnitsFilter: new UntypedFormControl(true),
      pathSkUnitsFilter: new UntypedFormControl(null),
      convertUnitTo: new UntypedFormControl('deg'),
      sampleTime: new UntypedFormControl(500),
      pathRequired: new UntypedFormControl(true)
    });

    const filterFixture = TestBed.createComponent(PathControlConfigComponent);
    filterFixture.componentRef.setInput('pathFormGroup', filterPathForm);
    filterFixture.componentRef.setInput('multiCTRLArray', [] as IDynamicControl[]);
    filterFixture.componentRef.setInput('filterSelfPaths', false);

    expect(() => filterFixture.detectChanges()).not.toThrow();
    expect(mockUnitsService.skBaseUnits).toEqual(baseUnitsSnapshot);
  });
});
