import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { IDynamicControl } from '../../core/interfaces/widgets-interface';

import { PathControlConfigComponent } from './path-control-config.component';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { DataService } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';

describe('PathControlConfigComponent', () => {
  let component: PathControlConfigComponent;
  let fixture: ComponentFixture<PathControlConfigComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [PathControlConfigComponent],
    providers: [
      { provide: SignalKConnectionService, useValue: { skServerVersion: '2.14.0' } }
      ,{ provide: DataService, useValue: {
          getPathObject: () => ({ displayName: 'Speed', meta: { units: 'knots' } }),
          getPathsAndMetaByType: () => ([])
        }
      },
      { provide: UnitsService, useValue: { skBaseUnits: [], getConversions: () => [] } }
    ]
})
    .compileComponents();
  }));

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
});
