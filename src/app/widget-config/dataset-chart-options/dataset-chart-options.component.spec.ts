import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UntypedFormControl } from '@angular/forms';
import { DatasetChartOptionsComponent } from './dataset-chart-options.component';
import { DataService } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';

describe('DatasetChartOptionsComponent', () => {
  let component: DatasetChartOptionsComponent;
  let fixture: ComponentFixture<DatasetChartOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatasetChartOptionsComponent],
      providers: [
        {
          provide: DataService,
          useValue: {
            getPathsAndMetaByType: () => [],
            getPathObject: () => null,
          },
        },
        {
          provide: UnitsService,
          useValue: {
            getConversionsForPath: () => ({ default: undefined, conversions: [] }),
          },
        },
      ],
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
