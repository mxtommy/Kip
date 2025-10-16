import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl } from '@angular/forms';
import { DisplayChartOptionsComponent } from './display-chart-options.component';

describe('ChartOptionsComponent', () => {
  let component: DisplayChartOptionsComponent;
  let fixture: ComponentFixture<DisplayChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayChartOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplayChartOptionsComponent);
    component = fixture.componentInstance;
    // Provide all required input controls via setInput API for InputSignal
    const set = fixture.componentRef.setInput.bind(fixture.componentRef) as (k: string, v: unknown) => void;
    set('displayName', new UntypedFormControl('Test Chart'));
    set('showLabel', new UntypedFormControl(true));
    set('convertUnitTo', new UntypedFormControl(''));
    set('datasetUUID', new UntypedFormControl(''));
    set('datasetAverageArray', new UntypedFormControl([]));
    set('showAverageData', new UntypedFormControl(false));
    set('trackAgainstAverage', new UntypedFormControl({ value: false, disabled: true }));
    set('showDatasetMinimumValueLine', new UntypedFormControl(false));
    set('showDatasetMaximumValueLine', new UntypedFormControl(false));
    set('showDatasetAverageValueLine', new UntypedFormControl(false));
    set('showDatasetAngleAverageValueLine', new UntypedFormControl(false));
    set('verticalChart', new UntypedFormControl(false));
    set('inverseYAxis', new UntypedFormControl(false));
    set('showTimeScale', new UntypedFormControl(true));
    set('showYScale', new UntypedFormControl(true));
    set('startScaleAtZero', new UntypedFormControl(true));
    set('yScaleSuggestedMin', new UntypedFormControl({ value: null, disabled: false }));
    set('yScaleSuggestedMax', new UntypedFormControl({ value: null, disabled: false }));
    set('enableMinMaxScaleLimit', new UntypedFormControl(false));
    set('yScaleMin', new UntypedFormControl({ value: null, disabled: true }));
    set('yScaleMax', new UntypedFormControl({ value: null, disabled: true }));
    set('numDecimal', new UntypedFormControl(2));
    set('color', new UntypedFormControl('#000000'));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
