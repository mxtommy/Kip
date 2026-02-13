import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatRadioChange } from '@angular/material/radio';
import { DisplayChartOptionsComponent } from './display-chart-options.component';

describe('ChartOptionsComponent', () => {
  let component: DisplayChartOptionsComponent;
  let fixture: ComponentFixture<DisplayChartOptionsComponent>;

  const applyRequiredInputs = (
    targetFixture: ComponentFixture<DisplayChartOptionsComponent>,
    overrides: Record<string, UntypedFormControl> = {}
  ): Record<string, UntypedFormControl> => {
    const controls: Record<string, UntypedFormControl> = {
      displayName: new UntypedFormControl('Test Chart'),
      showLabel: new UntypedFormControl(true),
      convertUnitTo: new UntypedFormControl(''),
      datasetUUID: new UntypedFormControl('dataset-1'),
      datasetAverageArray: new UntypedFormControl([]),
      showAverageData: new UntypedFormControl(false),
      showDataPoints: new UntypedFormControl(false),
      trackAgainstAverage: new UntypedFormControl({ value: true, disabled: false }),
      showDatasetMinimumValueLine: new UntypedFormControl(false),
      showDatasetMaximumValueLine: new UntypedFormControl(false),
      showDatasetAverageValueLine: new UntypedFormControl(false),
      showDatasetAngleAverageValueLine: new UntypedFormControl(false),
      verticalChart: new UntypedFormControl(false),
      inverseYAxis: new UntypedFormControl(false),
      showTimeScale: new UntypedFormControl(true),
      showYScale: new UntypedFormControl(true),
      startScaleAtZero: new UntypedFormControl(true),
      yScaleSuggestedMin: new UntypedFormControl({ value: 1, disabled: false }),
      yScaleSuggestedMax: new UntypedFormControl({ value: 100, disabled: false }),
      enableMinMaxScaleLimit: new UntypedFormControl(false),
      yScaleMin: new UntypedFormControl({ value: 0, disabled: true }),
      yScaleMax: new UntypedFormControl({ value: 120, disabled: true }),
      numDecimal: new UntypedFormControl(2),
      color: new UntypedFormControl('contrast'),
      ...overrides,
    };

    Object.entries(controls).forEach(([key, control]) => {
      targetFixture.componentRef.setInput(key, control);
    });

    return controls;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayChartOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplayChartOptionsComponent);
    component = fixture.componentInstance;
    applyRequiredInputs(fixture);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable trackAgainstAverage on init when moving average is disabled', () => {
    const localFixture = TestBed.createComponent(DisplayChartOptionsComponent);
    const controls = applyRequiredInputs(localFixture, {
      showAverageData: new UntypedFormControl(false),
      trackAgainstAverage: new UntypedFormControl({ value: true, disabled: false })
    });

    localFixture.detectChanges();

    expect(controls.trackAgainstAverage.disabled).toBeTrue();
  });

  it('should enable and disable fixed scale controls based on radio selection', () => {
    const yScaleMin = component.yScaleMin();
    const yScaleMax = component.yScaleMax();
    const yScaleSuggestedMin = component.yScaleSuggestedMin();
    const yScaleSuggestedMax = component.yScaleSuggestedMax();

    component.setScaleControls({ value: true } as MatRadioChange);
    expect(yScaleMin.disabled).toBeFalse();
    expect(yScaleMax.disabled).toBeFalse();
    expect(yScaleSuggestedMin.disabled).toBeTrue();
    expect(yScaleSuggestedMax.disabled).toBeTrue();

    component.setScaleControls({ value: false } as MatRadioChange);
    expect(yScaleMin.disabled).toBeTrue();
    expect(yScaleMax.disabled).toBeTrue();
    expect(yScaleSuggestedMin.disabled).toBeFalse();
    expect(yScaleSuggestedMax.disabled).toBeFalse();
  });

  it('should enable and disable trackAgainstAverage from checkbox events', () => {
    const trackAgainstAverage = component.trackAgainstAverage();

    component.enableTrackAgainstMovingAverage({ checked: true } as MatCheckboxChange);
    expect(trackAgainstAverage.disabled).toBeFalse();

    trackAgainstAverage.setValue(true);
    component.enableTrackAgainstMovingAverage({ checked: false } as MatCheckboxChange);
    expect(trackAgainstAverage.value).toBeFalse();
    expect(trackAgainstAverage.disabled).toBeTrue();
  });
});
