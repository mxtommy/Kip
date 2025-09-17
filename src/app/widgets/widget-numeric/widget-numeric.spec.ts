
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WidgetNumericComponent } from './widget-numeric.component';
import { IWidget } from '../../core/interfaces/widgets-interface';

describe('WidgetNumericChartComponent', () => {
  let component: WidgetNumericComponent;
  let fixture: ComponentFixture<WidgetNumericComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [WidgetNumericComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetNumericComponent);
    component = fixture.componentInstance;
    // provide required input
    component['widgetProperties'] = {
      uuid: 'test-uuid',
      type: 'widget-numeric',
      config: {
        displayName: 'Test',
        filterSelfPaths: true,
        paths: {
          numericPath: {
            description: 'Numeric Data',
            path: '',
            source: null,
            pathType: 'number',
            isPathConfigurable: true,
            convertUnitTo: 'unitless',
            showPathSkUnitsFilter: true,
            pathSkUnitsFilter: null,
            sampleTime: 500
          }
        },
        showMax: false,
        showMin: false,
        numDecimal: 1,
        showMiniChart: false,
        yScaleMin: 0,
        yScaleMax: 10,
        inverseYAxis: false,
        verticalChart: false,
        color: 'contrast',
        enableTimeout: false,
        dataTimeout: 5,
        ignoreZones: false
      }
    } as IWidget;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
