import { Component, OnDestroy, ElementRef, viewChild, inject, effect, NgZone, input, untracked } from '@angular/core';
import { DatasetStreamService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/dataset-stream.service';
import { IDatasetServiceDatasetConfig } from '../../core/services/dataset-stream.service';
import { Subscription } from 'rxjs';
import { CanvasService } from '../../core/services/canvas.service';
import { ITheme } from '../../core/services/app-service';
import { UnitsService } from '../../core/services/units.service';

import { Chart, ChartConfiguration, ChartData, TimeUnit, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, CategoryScale } from 'chart.js';
import 'chartjs-adapter-date-fns';

interface IChartColors {
  valueLine: string,
  valueFill: string,
  averageLine: string,
  averageFill: string,
  averageChartLine: string,
  chartLabel: string,
  chartValue: string
}
interface IDataSetRow {
  x: number,
  y: number
}

type AverageDatasetType = 'sma' | 'ema' | 'dema' | 'avg';

@Component({
  selector: 'minichart',
  imports: [],
  templateUrl: './minichart.component.html',
  styleUrls: ['./minichart.component.scss'],
})
export class MinichartComponent implements OnDestroy {
  protected readonly theme = input.required<ITheme>();
  public color: string | null = null;
  public dataPath: string | null = null;
  public dataSource: string | null = null;
  public convertUnitTo: string | null = null;
  public numDecimal: number | null = null;
  public yScaleMin: number | null = null;
  public yScaleMax: number | null = null;
  public inverseYAxis = false;
  public verticalChart: boolean | null = null;
  public datasetUUID: string | null = null;
  protected unitsService = inject(UnitsService);
  private readonly dsService = inject(DatasetStreamService);
  private readonly ngZone = inject(NgZone);
  private readonly canvasService = inject(CanvasService);
  readonly widgetDataChart = viewChild('widgetDataChart', { read: ElementRef });
  public lineChartData: ChartData<'line', { x: number, y: number }[]> = {
    datasets: []
  };
  public lineChartOptions: NonNullable<ChartConfiguration<'line', IDataSetRow[]>['options']> = {
    parsing: false,
    datasets: {
      line: {
        pointRadius: 0, // disable for all `'line'` datasets
        pointHoverRadius: 0, // disable for all `'line'` datasets
        tension: 0.4,
      }
    },
    animations: {
      tension: {
        easing: "easeInOutCubic"
      }
    }
  }
  public readonly lineChartType = 'line' as const;
  private chart: Chart<'line', IDataSetRow[]> | null = null;
  private dsServiceSub: Subscription | null = null;
  private datasetConfig: IDatasetServiceDatasetConfig | null = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo | null = null;
  private isDestroyed = false;
  private lastChartSignature: string | null = null;

  private config = {
    datasetAverageArray: 'sma' as AverageDatasetType,
    showAverageData: false,
    trackAgainstAverage: false,
    startScaleAtZero: false,
    yScaleSuggestedMin: null,
    yScaleSuggestedMax: null,
    enableMinMaxScaleLimit: false,
  };

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (theme) {
        untracked(() => {
          if (this.datasetConfig) {
            this.setChartOptions();
            this.setDatasetsColors();
          }
        });
      }
    });
  }

  public startChart(): void {
    if (this.isDestroyed || !this.datasetUUID) return;
    this.datasetConfig = this.dsService.getDatasetConfig(this.datasetUUID) ?? null;
    this.dataSourceInfo = this.dsService.getDataSourceInfo(this.datasetUUID) ?? null;

    if (this.datasetConfig && this.dataSourceInfo) {
      const chartSignature = this.buildChartSignature();
      if (this.chart && chartSignature === this.lastChartSignature) {
        return;
      }

      if (this.chart && chartSignature !== this.lastChartSignature) {
        this.destroyChart();
      }

      this.setChartOptions();
      this.createDatasets();
      const canvasEl = this.widgetDataChart()?.nativeElement as HTMLCanvasElement | undefined;
      const ctx = canvasEl?.getContext('2d');
      if (!ctx) return;

      this.chart = new Chart<'line', IDataSetRow[]>(ctx, {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions
      });

      this.lastChartSignature = chartSignature;

      this.startStreaming();
    }
  }

  private buildChartSignature(): string {
    return [
      this.datasetUUID,
      this.dataPath,
      this.dataSource,
      this.convertUnitTo,
      this.numDecimal,
      this.yScaleMin,
      this.yScaleMax,
      this.inverseYAxis ? '1' : '0',
      this.verticalChart ? '1' : '0',
      this.color
    ].join('|');
  }

  private setChartOptions() {
    const datasetConfig = this.datasetConfig;
    const dataSourceInfo = this.dataSourceInfo;
    if (!datasetConfig || !dataSourceInfo) {
      return;
    }

    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = this.verticalChart ? 'y' : 'x';

    if (this.verticalChart) {
      this.lineChartOptions.scales = {
        x: {
          display: false,
          position: "right",
          suggestedMin: this.config.enableMinMaxScaleLimit ? undefined : this.numberOrUndefined(this.yScaleMin),
          suggestedMax: this.config.enableMinMaxScaleLimit ? undefined : this.numberOrUndefined(this.yScaleMax),
          min: this.config.enableMinMaxScaleLimit ? this.numberOrUndefined(this.yScaleMin) : undefined,
          max: this.config.enableMinMaxScaleLimit ? this.numberOrUndefined(this.yScaleMax) : undefined,
          beginAtZero: this.config.startScaleAtZero,
          reverse: this.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.numberOrUndefined(this.numDecimal),
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true,
            }
          },
          grid: {
            display: false,
            color: this.theme().contrastDimmer
          }
        },
        y: {
          type: "realtime",
          display: false,
          title: {
            display: false
          },
          time: {
            unit: datasetConfig.timeScaleFormat as TimeUnit,
            minUnit: "second",
            round: "second",
            displayFormats: {
              // eslint-disable-next-line no-useless-escape
              hour: `k:mm\''`,
              // eslint-disable-next-line no-useless-escape
              minute: `mm\''`,
              second: `ss"`,
              millisecond: "SSS"
            },
          },
          ticks: {
            autoSkip: false,
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true
            }
          },
          grid: {
            display: false,
            color: this.theme().contrastDimmer
          }
        }
      };
    } else {
      this.lineChartOptions.scales = {
        x: {
          type: "realtime",
          display: false,
          title: {
            display: false
          },
          time: {
            unit: datasetConfig.timeScaleFormat as TimeUnit,
            minUnit: "second",
            round: "second",
            displayFormats: {
              // eslint-disable-next-line no-useless-escape
              hour: `k:mm\''`,
              // eslint-disable-next-line no-useless-escape
              minute: `mm\''`,
              second: `ss"`,
              millisecond: "SSS"
            },
          },
          ticks: {
            autoSkip: false,
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true
            }
          },
          grid: {
            display: false,
            color: this.theme().contrastDimmer
          }
        },
        y: {
          display: false,
          position: "right",
          suggestedMin: this.config.enableMinMaxScaleLimit ? undefined : this.numberOrUndefined(this.yScaleMin),
          suggestedMax: this.config.enableMinMaxScaleLimit ? undefined : this.numberOrUndefined(this.yScaleMax),
          min: this.config.enableMinMaxScaleLimit ? this.numberOrUndefined(this.yScaleMin) : undefined,
          max: this.config.enableMinMaxScaleLimit ? this.numberOrUndefined(this.yScaleMax) : undefined,
          beginAtZero: this.config.startScaleAtZero,
          reverse: this.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.numberOrUndefined(this.numDecimal),
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true,
            }
          },
          grid: {
            display: false,
            color: this.theme().contrastDimmer
          }
        }
      };
    }

    this.lineChartOptions.plugins = {
      legend: {
        display: false
      },
       streaming: {
        duration: dataSourceInfo.maxDataPoints * dataSourceInfo.sampleTime,
        delay: dataSourceInfo.sampleTime,
        frameRate: datasetConfig.timeScaleFormat === "day" ? 5 : datasetConfig.timeScaleFormat === "hour" ? 8 : datasetConfig.timeScaleFormat === "minute" ? 15 : 30,
       }
    }
  }

  private numberOrUndefined(value: number | null): number | undefined {
    return value ?? undefined;
  }

  private createDatasets() {
    const fillDirection = this.lineChartOptions.scales?.y?.reverse ? 'start' : true;
    this.lineChartData.datasets = [];
    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        order: 0,
        parsing: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 3,
        fill: fillDirection,
      }
    );

    this.lineChartData.datasets.push(
      {
        label: 'Average',
        data: [],
        order: 1,
        parsing: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 3,
        fill: fillDirection,
      }
    );

    this.setDatasetsColors();
  }

  private setDatasetsColors(): void {
    this.lineChartData.datasets.forEach((dataset) => {
      dataset.borderColor = this.getThemeColors().averageLine;
      dataset.backgroundColor = this.getThemeColors().averageFill;
    });
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.color;
    const colors: IChartColors = {
      valueLine: '',
      valueFill: '',
      averageLine: '',
      averageFill: '',
      averageChartLine: '',
      chartLabel: '',
      chartValue: ''
    };

    switch (widgetColor) {
      case "contrast":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().contrastDimmer;
          colors.valueFill = this.theme().contrastDimmer;
          colors.averageLine = this.theme().contrast;
          colors.averageFill = this.theme().contrast;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().contrast;
          colors.valueFill = this.theme().contrast;
          colors.averageLine = this.theme().contrastDimmer;
          colors.averageFill = this.theme().contrastDimmer;
          colors.chartValue = this.theme().contrast;
        }
        colors.averageChartLine = this.theme().contrastDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "blue":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().blueDimmer;
          colors.valueFill = this.theme().blueDimmer;
          colors.averageLine = this.theme().blue;
          colors.averageFill = this.theme().blue;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().blue;
          colors.valueFill = this.theme().blue;
          colors.averageLine = this.theme().blueDimmer;
          colors.averageFill = this.theme().blueDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().blueDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "green":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().greenDimmer;
          colors.valueFill = this.theme().greenDimmer;
          colors.averageLine = this.theme().green;
          colors.averageFill = this.theme().green;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().green;
          colors.valueFill = this.theme().green;
          colors.averageLine = this.theme().greenDimmer;
          colors.averageFill = this.theme().greenDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().greenDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "pink":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().pinkDimmer;
          colors.valueFill = this.theme().pinkDimmer;
          colors.averageLine = this.theme().pink;
          colors.averageFill = this.theme().pink;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().pink;
          colors.valueFill = this.theme().pink;
          colors.averageLine = this.theme().pinkDimmer;
          colors.averageFill = this.theme().pinkDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().pinkDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "orange":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().orangeDimmer;
          colors.valueFill = this.theme().orangeDimmer;
          colors.averageLine = this.theme().orange;
          colors.averageFill = this.theme().orange;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().orange;
          colors.valueFill = this.theme().orange;
          colors.averageLine = this.theme().orangeDimmer;
          colors.averageFill = this.theme().orangeDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().orangeDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "purple":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().purpleDimmer;
          colors.valueFill = this.theme().purpleDimmer;
          colors.averageLine = this.theme().purple;
          colors.averageFill = this.theme().purple;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().purple;
          colors.valueFill = this.theme().purple;
          colors.averageLine = this.theme().purpleDimmer;
          colors.averageFill = this.theme().purpleDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().purpleDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "grey":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().greyDimmer;
          colors.valueFill = this.theme().greyDimmer;
          colors.averageLine = this.theme().grey;
          colors.averageFill = this.theme().grey;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().grey;
          colors.valueFill = this.theme().grey;
          colors.averageLine = this.theme().greyDimmer;
          colors.averageFill = this.theme().greyDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().greyDim;
        colors.chartLabel = this.theme().contrastDim;
        break;

      case "yellow":
        if (this.config.trackAgainstAverage) {
          colors.valueLine = this.theme().yellowDimmer;
          colors.valueFill = this.theme().yellowDimmer;
          colors.averageLine = this.theme().yellow;
          colors.averageFill = this.theme().yellow;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme().yellow;
          colors.valueFill = this.theme().yellow;
          colors.averageLine = this.theme().yellowDimmer;
          colors.averageFill = this.theme().yellowDimmer;
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme().yellowDim;
        colors.chartLabel = this.theme().contrastDim;
        break;
    }
    return colors;
  }

  private startStreaming(): void {
    this.dsServiceSub?.unsubscribe();
    if (!this.datasetUUID || !this.chart) {
      return;
    }

    const batchThenLive$ = this.dsService.getDatasetBatchThenLiveObservable(
      this.datasetUUID
    );
    if (!batchThenLive$) {
      return;
    }

    this.dsServiceSub = batchThenLive$.subscribe(dsPointOrBatch => {
      if (this.isDestroyed || !this.chart) return;
      const chartWithCtx = this.chart as Chart<'line', IDataSetRow[]> & { ctx?: CanvasRenderingContext2D | null };
      if (!chartWithCtx.ctx) return;

      if (Array.isArray(dsPointOrBatch)) {
        // Initial batch: fill the chart with the last N points
        const valueRows = this.transformDatasetRows(dsPointOrBatch, 0);
        this.chart.data.datasets[0].data.push(...valueRows);
        if (this.config.showAverageData) {
          const avgRows = this.transformDatasetRows(dsPointOrBatch, this.config.datasetAverageArray);
          this.chart.data.datasets[1].data.push(...avgRows);
        }
      } else {
        // Live: handle new single datapoint
        const valueRow = this.transformDatasetRows([dsPointOrBatch], 0)[0];
        this.chart.data.datasets[0].data.push(valueRow);
        /* if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          this.chart.data.datasets[0].data.shift();
        } */

        if (this.config.showAverageData) {
          const avgRow = this.transformDatasetRows([dsPointOrBatch], this.config.datasetAverageArray)[0];
          this.chart.data.datasets[1].data.push(avgRow);
          /* if (this.chart.data.datasets[1].data.length > this.dataSourceInfo.maxDataPoints) {
            this.chart.data.datasets[1].data.shift();
          } */
        }
      }

      this.ngZone.runOutsideAngular(() => {
        if (this.isDestroyed || !this.chart) return;
        const safeChart = this.chart as Chart<'line', IDataSetRow[]> & { ctx?: CanvasRenderingContext2D | null; update: (mode?: string) => void };
        if (!safeChart.ctx) return;
        safeChart.update('none');
      });
    });
  }

  private destroyChart(): void {
    this.dsServiceSub?.unsubscribe();
    this.dsServiceSub = null;
    this.chart?.destroy();
    this.chart = null;
    this.lastChartSignature = null;
  }

  private transformDatasetRows(rows: IDatasetServiceDatapoint[], datasetType: 0 | AverageDatasetType): IDataSetRow[] {
    const convert = (v: number) =>
      this.unitsService.convertToUnit(this.convertUnitTo ?? '', v) ?? v;
    const verticalChart = this.verticalChart === true;
    const avgKey = this.config.datasetAverageArray;

    return rows.map(row => {
      if (verticalChart) {
        if (datasetType === 0) {
          return { x: convert(row.data.value), y: row.timestamp };
        } else {
          const avgMap = {
            sma: row.data.sma,
            ema: row.data.ema,
            dema: row.data.doubleEma,
            avg: row.data.lastAverage
          };
          return { x: convert(avgMap[avgKey] ?? row.data.value), y: row.timestamp };
        }
      } else {
        if (datasetType === 0) {
          return { x: row.timestamp, y: convert(row.data.value) };
        } else {
          const avgMap = {
            sma: row.data.sma,
            ema: row.data.ema,
            dema: row.data.doubleEma,
            avg: row.data.lastAverage
          };
          return { x: row.timestamp, y: convert(avgMap[avgKey] ?? row.data.value) };
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroyChart();
    const canvas = this.widgetDataChart?.()?.nativeElement as HTMLCanvasElement | undefined;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
  }
}
