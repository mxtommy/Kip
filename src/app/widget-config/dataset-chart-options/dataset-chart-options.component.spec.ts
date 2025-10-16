import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl } from '@angular/forms';
import { DatasetChartOptionsComponent } from './dataset-chart-options.component';

describe('DatasetChartOptionsComponent', () => {
  let component: DatasetChartOptionsComponent;
  let fixture: ComponentFixture<DatasetChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetChartOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatasetChartOptionsComponent);
    component = fixture.componentInstance;
    const set = fixture.componentRef.setInput.bind(fixture.componentRef) as (k: string, v: unknown) => void;
    set('convertUnitTo', new UntypedFormControl(''));
    set('filterSelfPaths', new UntypedFormControl(false));
    set('datachartPath', new UntypedFormControl(''));
    set('datachartSource', new UntypedFormControl({ value: '', disabled: true }));
    set('timeScale', new UntypedFormControl(''));
    set('period', new UntypedFormControl(''));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
