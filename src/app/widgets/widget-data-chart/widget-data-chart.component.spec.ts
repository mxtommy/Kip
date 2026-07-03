import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

vi.mock('chart.js', () => {
  class MockChart {
    static defaults = {
      color: '#000',
      font: { family: 'sans-serif' },
    };

    static register = vi.fn();

    public config: { type: string; data: unknown; options: unknown; plugins?: unknown[] };
    public data: unknown;
    public options: unknown;

    constructor(_ctx: unknown, config: { type: string; data: unknown; options: unknown; plugins?: unknown[] }) {
      this.config = config;
      this.data = config.data;
      this.options = config.options;
    }

    update = vi.fn();
    destroy = vi.fn();
  }

  class Stub {}

  return {
    Chart: MockChart,
    TimeScale: Stub,
    LinearScale: Stub,
    LineController: Stub,
    PointElement: Stub,
    LineElement: Stub,
    Filler: Stub,
    Title: Stub,
    SubTitle: Stub,
  };
});

import { WidgetDataChartComponent } from './widget-data-chart.component';
import { DatasetStreamService } from '../../core/services/dataset-stream.service';
import { CanvasService } from '../../core/services/canvas.service';
import { UnitsService } from '../../core/services/units.service';
import { WidgetDatasetOrchestratorService } from '../../core/services/widget-dataset-orchestrator.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';

describe('WidgetDataChartComponent', () => {
  let component: WidgetDataChartComponent;
  let fixture: ComponentFixture<WidgetDataChartComponent>;

  const runtimeConfig = {
    ...WidgetDataChartComponent.DEFAULT_CONFIG,
    displayName: 'Chart Label',
    datachartPath: 'navigation.speedOverGround',
    datachartSource: null,
    timeScale: 'minute',
    period: 10,
    color: 'contrast',
    showLabel: true,
    showYScale: false,
    showTimeScale: false,
    verticalChart: false,
    inverseYAxis: false,
    startScaleAtZero: false,
    enableMinMaxScaleLimit: false,
    yScaleSuggestedMin: undefined,
    yScaleSuggestedMax: undefined,
    yScaleMin: undefined,
    yScaleMax: undefined,
    datasetAverageArray: 'sma',
    showAverageData: true,
    trackAgainstAverage: false,
    showDatasetMinimumValueLine: false,
    showDatasetMaximumValueLine: false,
    showDatasetAverageValueLine: true,
    numDecimal: 1,
    convertUnitTo: null,
  };

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtimeStub: any = {
      options: () => runtimeConfig,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasetServiceStub: any = {
      getDatasetConfig: () => ({ period: 10, timeScaleFormat: 'minute' }),
      getDataSourceInfo: () => ({ maxDataPoints: 30, sampleTime: 1000 }),
      getDatasetBatchThenLiveObservable: () => of([]),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasetLifecycleStub: any = {
      syncDataChartDataset: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasServiceStub: any = {
      releaseCanvas: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitsServiceStub: any = {
      convertToUnit: (_unit: string, value: number) => value,
    };

    await TestBed.configureTestingModule({
      imports: [WidgetDataChartComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: runtimeStub },
        { provide: DatasetStreamService, useValue: datasetServiceStub },
        { provide: WidgetDatasetOrchestratorService, useValue: datasetLifecycleStub },
        { provide: CanvasService, useValue: canvasServiceStub },
        { provide: UnitsService, useValue: unitsServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetDataChartComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('id', 'widget-data-chart-1');
    fixture.componentRef.setInput('type', 'widget-data-chart');
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

    fixture.detectChanges();

    const canvas = component.widgetDataChart()?.nativeElement as HTMLCanvasElement | undefined;
    if (canvas) {
      vi.spyOn(canvas, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
    }
  });

  it('uses annotation options while not configuring annotation as an inline chart plugin (only global plugin registration is supported as of annotation 3.0.1)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).rebuildForDataset(runtimeConfig);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartConfig = ((component as any).chart?.config ?? {}) as { plugins?: unknown[]; options?: { plugins?: { annotation?: { annotations?: Record<string, unknown> } } } };

    expect(chartConfig.plugins).toBeUndefined();
    expect(chartConfig.options?.plugins?.annotation?.annotations).toMatchObject({
      minimumLine: expect.any(Object),
      maximumLine: expect.any(Object),
      averageLine: expect.any(Object),
    });
  });
});
