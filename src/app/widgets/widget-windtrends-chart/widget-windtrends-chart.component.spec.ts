import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetWindTrendsChartComponent } from './widget-windtrends-chart.component';
import { DatasetStreamService } from '../../core/services/dataset-stream.service';
import { WidgetDatasetOrchestratorService } from '../../core/services/widget-dataset-orchestrator.service';
import { CanvasService } from '../../core/services/canvas.service';
import { UnitsService } from '../../core/services/units.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';

describe('WidgetWindTrendsChartComponent', () => {
  let component: WidgetWindTrendsChartComponent;
  let fixture: ComponentFixture<WidgetWindTrendsChartComponent>;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDatasetStream: any = {
      getDatasetConfig: () => null,
      getDataSourceInfo: () => null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDatasetLifecycle: any = {
      ensureDataset: () => {},
      cleanupOwner: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCanvasService: any = {
      getTheme: () => ({}),
      releaseCanvas: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUnitsService: any = {
      convertToUnit: (_unit: string, value: number) => value,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockBreakpointObserver: any = {
      observe: () => of({}),
    };

    await TestBed.configureTestingModule({
      imports: [WidgetWindTrendsChartComponent],
      providers: [
        { provide: DatasetStreamService, useValue: mockDatasetStream },
        { provide: WidgetDatasetOrchestratorService, useValue: mockDatasetLifecycle },
        { provide: CanvasService, useValue: mockCanvasService },
        { provide: UnitsService, useValue: mockUnitsService },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetWindTrendsChartComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize empty annotation options for chart plugin safety', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testComponent = component as any;

    fixture.componentRef.setInput('theme', {
      background: '#000',
      contrast: '#fff',
      contrastDim: '#ccc',
      contrastDimmer: '#999'
    });

    testComponent.datasetConfig = { timeScaleFormat: 'Last 30 Minutes' };
    testComponent.dataSourceInfo = { maxDataPoints: 30, sampleTime: 1000 };

    testComponent.setChartOptions();

    expect(testComponent.lineChartOptions.plugins?.annotation).toEqual({ annotations: {} });
  });

  describe('dataset guards - prevents annotation plugin errors', () => {
    it('should validate that all datasets are properly initialized', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      // Mock chart with valid datasets (10 datasets with data arrays)
      testComponent.chart = {
        data: {
          datasets: Array(10).fill(null).map(() => ({ data: [] }))
        },
        destroy: () => {}
      };

      const isValid = testComponent.hasValidDatasets();
      expect(isValid).toBe(true);
    });

    it('should reject chart with fewer than 10 datasets', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      testComponent.chart = {
        data: {
          datasets: Array(5).fill(null).map(() => ({ data: [] }))
        },
        destroy: () => {}
      };

      const isValid = testComponent.hasValidDatasets();
      expect(isValid).toBe(false);
    });

    it('should reject chart with undefined dataset', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      testComponent.chart = {
        data: {
          datasets: Array(10).fill(null).map((_, i) => (
            i === 3 ? null : { data: [] }
          ))
        },
        destroy: () => {}
      };

      const isValid = testComponent.hasValidDatasets();
      expect(isValid).toBe(false);
    });

    it('should reject dataset without data array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      testComponent.chart = {
        data: {
          datasets: Array(10).fill(null).map((_, i) => ({
            data: i === 5 ? null : []
          }))
        },
        destroy: () => {}
      };

      const isValid = testComponent.hasValidDatasets();
      expect(isValid).toBe(false);
    });
  });

  describe('pushRowsGeneric - safe dataset access', () => {
    it('should safely handle missing datasets without throwing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      testComponent.chart = {
        data: {
          datasets: [
            { data: [] },
            // Intentionally missing datasets
          ]
        },
        destroy: () => {}
      };

      testComponent.transformRows = () => [{ x: 45, y: 100 }];

      // Should not throw
      expect(() => {
        testComponent.pushRowsGeneric([], 0, 'deg', false);
      }).not.toThrow();
    });

    it('should skip null datasets without throwing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testComponent = component as any;

      testComponent.chart = {
        data: {
          datasets: [
            null,
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
          ]
        },
        destroy: () => {}
      };

      testComponent.transformRows = () => [{ x: 45, y: 100 }];

      // Should not throw
      expect(() => {
        testComponent.pushRowsGeneric([], 0, 'deg', false);
      }).not.toThrow();
    });
  });
});
