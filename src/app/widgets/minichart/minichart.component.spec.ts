import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { MinichartComponent } from './minichart.component';
import { DatasetStreamService } from '../../core/services/dataset-stream.service';
import { CanvasService } from '../../core/services/canvas.service';
import { UnitsService } from '../../core/services/units.service';

describe('MinichartComponent', () => {
  let component: MinichartComponent;
  let fixture: ComponentFixture<MinichartComponent>;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDatasetStream: any = {
      getDatasetConfig: () => null,
      getDataSourceInfo: () => null,
      getDatasetBatchThenLiveObservable: () => of([]),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCanvasService: any = {
      releaseCanvas: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUnitsService: any = {
      convertToUnit: (_unit: string, value: number) => value,
    };

    await TestBed.configureTestingModule({
      imports: [MinichartComponent],
      providers: [
        { provide: DatasetStreamService, useValue: mockDatasetStream },
        { provide: CanvasService, useValue: mockCanvasService },
        { provide: UnitsService, useValue: mockUnitsService },
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MinichartComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('theme', {
      contrast: '#fff',
      contrastDim: '#ccc',
      contrastDimmer: '#999',
      blue: '#00f',
      blueDim: '#00c',
      blueDimmer: '#009',
      green: '#0f0',
      greenDim: '#0c0',
      greenDimmer: '#090',
      pink: '#f0f',
      pinkDim: '#c0c',
      pinkDimmer: '#909',
      orange: '#f90',
      orangeDim: '#c70',
      orangeDimmer: '#950',
      purple: '#90f',
      purpleDim: '#70c',
      purpleDimmer: '#509',
      grey: '#888',
      greyDim: '#666',
      greyDimmer: '#444',
      yellow: '#ff0',
      yellowDim: '#cc0',
      yellowDimmer: '#990',
    });
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize empty annotation options for plugin safety', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testComponent = component as any;

    testComponent.datasetConfig = { timeScaleFormat: 'minute' };
    testComponent.dataSourceInfo = { maxDataPoints: 30, sampleTime: 1000 };

    testComponent.setChartOptions();

    expect(testComponent.lineChartOptions.plugins?.annotation).toEqual({ annotations: {} });
  });
});
