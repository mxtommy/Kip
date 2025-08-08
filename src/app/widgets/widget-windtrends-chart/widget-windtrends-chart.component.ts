import { IDatasetServiceDatasetConfig, TimeScaleFormat } from '../../core/services/data-set.service';
import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, viewChild, inject, effect, NgZone } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle, ChartArea } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';

Chart.register(annotationPlugin, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle);

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

@Component({
  selector: 'widget-windtrends-chart',
  imports: [WidgetHostComponent],
  templateUrl: './widget-windtrends-chart.component.html',
  styleUrl: './widget-windtrends-chart.component.scss'
})
export class WidgetWindTrendsChartComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly _dataset = inject(DatasetService);
  readonly widgetDataChart = viewChild('widgetDataChart', { read: ElementRef });
  public lineChartData: ChartData <'line', {x: number, y: number} []> = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: false,
    datasets: {
      line: {
        pointRadius: 0,
        pointHoverRadius: 0,
        tension:  0.3,
      }
    },
    animations: {
      tension: {
        easing: "easeInOutCubic"
      }
    }
  }
  public lineChartType: ChartType = 'line';
  private chart;
  private _dsServiceSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo = null;

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      color: 'contrast',
      timeScale: ''
    };

    effect(() => {
      if (this.theme()) {
        if (this.datasetConfig) {
          this.setChartOptions();
          this.setDatasetsColors();
        }
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.createServiceDataset();
  }

  ngAfterViewInit(): void {
    this.startWidget();
    this.testSimulateCrossingZero();
  }

  protected startWidget(): void {
    this.datasetConfig = this._dataset.getDatasetConfig(this.widgetProperties.uuid);
    this.dataSourceInfo = this._dataset.getDataSourceInfo(this.widgetProperties.uuid);

    if (this.datasetConfig) {
      this.createDatasets();
      this.setChartOptions();

      if (!this.chart) {
        this.chart = new Chart(this.widgetDataChart().nativeElement.getContext('2d'), {
          type: this.lineChartType,
          data: this.lineChartData,
          options: this.lineChartOptions
        });
      } else {
        this.ngZone.runOutsideAngular(() => {
          this.chart?.update('quiet');
        });
      }

      //this.startStreaming();
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    // Create dataset if it does not exist
    if (this._dataset.list().filter(ds => ds.uuid === this.widgetProperties.uuid).length === 0) {
      this._dataset.remove(this.widgetProperties.uuid);
    }
    this.createServiceDataset();
    this.startWidget();
  }

  private createServiceDataset(): void {
    if (this.widgetProperties.config.timeScale === '') return;
    const pathInfo = "self.environment.wind.directionTrue";
    const source = "default";

    // Create dataset if it does not exist
    if (this._dataset.list().filter(ds => ds.uuid === this.widgetProperties.uuid).length === 0) {
      this._dataset.create(pathInfo, source, this.widgetProperties.config.timeScale as TimeScaleFormat, 30, `windtrends-${this.widgetProperties.uuid}`, true, false, this.widgetProperties.uuid);
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = 'y';

    this.lineChartOptions.scales = {
      y: {
        type: "time",
        display: true,
        position: "right",
        title: {
          display: true,
          text: `${this.datasetConfig.timeScaleFormat}`,
          align: "center"
        },
        time: {
          minUnit: "second",
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
          maxTicksLimit: 6,
          autoSkip: false,
          includeBounds: true,
          align: 'inner',
          major: {
            enabled: true
          },
          font: {
            size: 16,
          },
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer
        }
      },
      x: {
        type: "linear",
        position: "top",
        beginAtZero: false,
        // min/max will be set dynamically in updateChartAfterDataChange
        title: { display: false },
        ticks: {
          callback: (value: number) => ((value % 360 + 360) % 360).toFixed(0), // show wrapped angle
          font: { size: 20 },
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer
        }
      }
    };

    this.lineChartOptions.plugins = {
      title: {
        display: true,
        align: "center",
        padding: { top: -3, bottom: -20 },
        text: "",
        font: { size: 62 },
        color: this.getThemeColors().chartValue
      },
      subtitle: {
        display: true,
        align: "start",
        padding: { top: -45, bottom: 10 },
        text: `  TWD`,
        font: { size: 28 },
        color: this.getThemeColors().chartLabel
      },
      annotation : {
        annotations: {
          averageLine: {
            type: 'line',
            scaleID: 'x',
            display: true,
            value: null,
            borderColor: this.getThemeColors().averageChartLine,
            drawTime: 'beforeDatasetsDraw',
            borderWidth: 4,
            label: {
              xAdjust: 0,
              yAdjust: -8,
              display: true,
              position: "start",
              padding: 8,
              font: { size: 22 },
              color: this.getThemeColors().chartValue,
              backgroundColor: 'rgba(63,63,63,1)',
              drawTime: 'afterDatasetsDraw',
            }
          }
        }
      },
      legend: { display: false }
    }
  }

  private createDatasets() {
    this.lineChartData.datasets = [];
    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        order: 2,
        parsing: false,
        normalized: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 1,
        fill: false,
      },
      {
        label: 'SMA',
        data: [],
        order: 0,
        parsing: false,
        normalized: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 10,
        fill: false,
        borderColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea, data } = chart;

          if (!chartArea) {
            return null; // This happens on initial render before chartArea is defined
          }
          if (!data.datasets[2].data.length) {
            return null; // We need some data
          }

          return this.lineGradian(ctx, chartArea);
        },
        backgroundColor: 'red'
      },
      {
        label: 'lastAverage',
        data: [],
        order: 1,
        parsing: false,
        normalized: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 0,
        borderColor: '',
        fill: false,
        hidden: true,
      },
      {
        label: 'lastMinimum',
        data: [],
        order: 3,
        parsing: false,
        normalized: true,
        hidden: true,
      },
      {
        label: 'lastMaximum',
        data: [],
        order: 4,
        parsing: false,
        normalized: true,
        hidden: true,
      }
    );

    this.setDatasetsColors();
  }

public testSimulateCrossingZero(): void {
  const testData: IDatasetServiceDatapoint[] = [
    { timestamp: 1, data: { value: 6.1959, sma: 6.1959, lastAverage: 6.1959, lastMinimum: 6.1959, lastMaximum: 6.1959 } }, // ~355°
    { timestamp: 2, data: { value: 6.2483, sma: 6.2483, lastAverage: 6.2221, lastMinimum: 6.1959, lastMaximum: 6.2483 } }, // ~358°
    { timestamp: 3, data: { value: 0.0175, sma: 0.0175, lastAverage: 0.0175, lastMinimum: 0.0175, lastMaximum: 0.0175 } }, // ~1°
    { timestamp: 4, data: { value: 0.0524, sma: 0.0524, lastAverage: 0.0349, lastMinimum: 0.0175, lastMaximum: 0.0524 } }, // ~3°
    { timestamp: 5, data: { value: 0.0873, sma: 0.0873, lastAverage: 0.0524, lastMinimum: 0.0175, lastMaximum: 0.0873 } }, // ~5°
  ];

  this.createDatasets();
  this.pushRowsToDatasets(testData);
  this.updateChartAfterDataChange();
  this.ngZone.runOutsideAngular(() => {
    this.chart?.update('quiet');
  });
}

  private startStreaming(): void {
    this._dsServiceSub?.unsubscribe();

    const batchThenLive$ = this._dataset.getDatasetBatchThenLiveObservable(this.widgetProperties.uuid);

    this._dsServiceSub = batchThenLive$?.subscribe(dsPointOrBatch => {
      if (Array.isArray(dsPointOrBatch)) {
        // Initial batch: fill the chart with the last N points
        this.pushRowsToDatasets(dsPointOrBatch);
      } else {
        // Live: handle new single datapoint
        this.pushRowsToDatasets([dsPointOrBatch]);

        if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          this.chart.data.datasets.forEach(ds => ds.data.shift());
        }
      }

      this.updateChartAfterDataChange();

      this.ngZone.runOutsideAngular(() => {
        this.chart?.update('quiet');
      });
    });
  }

  private unwrapAngles(degrees: (number|null)[]): (number|null)[] {
    if (degrees.length === 0) return [];
    const unwrapped: (number|null)[] = [];
    let prev = null;
    for (const val of degrees) {
      if (val == null) {
        unwrapped.push(null);
        continue;
      }
      if (prev == null) {
        unwrapped.push(val);
        prev = val;
        continue;
      }
      let delta = val - prev;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      unwrapped.push(unwrapped[unwrapped.length - 1]! + delta);
      prev = val;
    }
    return unwrapped;
  }

  private pushRowsToDatasets(rows: IDatasetServiceDatapoint[]): void {
    this.chart.data.datasets[0].data.push(...this.transformDatasetRows(rows, 'value'));
    this.chart.data.datasets[1].data.push(...this.transformDatasetRows(rows, 'sma'));
    this.chart.data.datasets[2].data.push(...this.transformDatasetRows(rows, 'avg'));
    this.chart.data.datasets[3].data.push(...this.transformDatasetRows(rows, 'min'));
    this.chart.data.datasets[4].data.push(...this.transformDatasetRows(rows, 'max'));
  }

  private transformDatasetRows(rows: IDatasetServiceDatapoint[], datasetType: string): IDataSetRow[] {
    // Convert radians to degrees (do not normalize here)
    const degs = rows.map(row => {
      const rowMapping = {
        value: row.data.value,
        sma: row.data.sma,
        ema: row.data.ema,
        dema: row.data.doubleEma,
        avg: row.data.lastAverage,
        min: row.data.lastMinimum,
        max: row.data.lastMaximum
      };
      const v = rowMapping[datasetType];
      return v == null ? null : this.unitsService.convertToUnit("deg", v);
    });

    // Unwrap the angles for continuity
    const unwrapped = this.unwrapAngles(degs);

    // Map back to rows, skipping nulls
    return rows.map((row, idx) => ({
      x: unwrapped[idx],
      y: row.timestamp
    }));
  }

  private normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  private updateChartAfterDataChange() {
    // Update Title value
    const lastData = this.chart.data.datasets[2].data;
    const last = lastData.length - 1;
    const lastAverage = lastData[last]?.x ?? 0;
    const trackValue: number = this.chart.data.datasets[0].data[last]?.x ?? 0;
    this.chart.options.plugins.title.text = `${this.normalizeAngle(trackValue).toFixed(0)}°`;

    // Update last min/max lines
    const lastMinimum = this.chart.data.datasets[3].data[last]?.x ?? 0;
    const lastMaximum = this.chart.data.datasets[4].data[last]?.x ?? 0;

    // Calculate dynamic x value scale range
    const minDiff = Math.abs(lastAverage - lastMinimum);
    const maxDiff = Math.abs(lastMaximum - lastAverage);
    const dynamicScaleRange = Math.max(minDiff, maxDiff);
    this.chart.options.scales.x.min = lastAverage - dynamicScaleRange;
    this.chart.options.scales.x.max = lastAverage + dynamicScaleRange;

    // Update dynamic y axis time range
    const yData = this.chart.data.datasets[0].data;
    if (yData.length > 0) {
      this.chart.options.scales.y.min = yData[0].y;
      this.chart.options.scales.y.max = yData[yData.length - 1].y;
    }

    // Draw average line
    if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
      this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
      this.chart.options.plugins.annotation.annotations.averageLine.label.content = `${this.normalizeAngle(lastAverage).toFixed(0)}°`;
    }
  }

  private lineGradian(ctx: CanvasRenderingContext2D, chartArea: ChartArea): CanvasGradient {
    const gradientBorder = ctx.createLinearGradient(0, 0, chartArea.right, 0);
    const r = (chartArea.left + (chartArea.width / 2)) / chartArea.right;
    gradientBorder.addColorStop(0, this.theme().port);
    gradientBorder.addColorStop(r, this.theme().port);
    gradientBorder.addColorStop(r, this.theme().starboard);
    gradientBorder.addColorStop(1, this.theme().starboard);
    return gradientBorder;
  }

  private setDatasetsColors(): void {
    this.lineChartData.datasets.forEach((dataset) => {
      if (dataset.label === 'Value') {
        dataset.borderColor = this.getThemeColors().valueLine;
        dataset.backgroundColor = this.getThemeColors().valueFill;
      }
    });
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.widgetProperties.config.color;
    const colors: IChartColors = {
      valueLine: null,
      valueFill: null,
      averageLine: null,
      averageFill: null,
      averageChartLine: null,
      chartLabel: null,
      chartValue: null
    };

    switch (widgetColor) {
      case "contrast":
        colors.valueLine = this.theme().contrastDim;
        colors.valueFill = this.theme().contrastDimmer;
        colors.averageLine = this.theme().contrast;
        colors.averageFill = this.theme().contrast;
        colors.chartValue = this.theme().contrast;
        colors.averageChartLine = this.theme().contrast;
        colors.chartLabel = this.theme().contrastDim;
        break;
      case "blue":
        colors.valueLine = this.theme().blueDim;
        colors.valueFill = this.theme().blueDimmer;
        colors.averageLine = this.theme().blue;
        colors.averageFill = this.theme().blue;
        colors.chartValue = this.theme().blue;
        colors.averageChartLine = this.theme().blueDim;
        colors.chartLabel = this.theme().blueDim;
        break;
      case "green":
        colors.valueLine = this.theme().greenDim;
        colors.valueFill = this.theme().greenDimmer;
        colors.averageLine = this.theme().green;
        colors.averageFill = this.theme().green;
        colors.chartValue = this.theme().green;
        colors.averageChartLine = this.theme().greenDim;
        colors.chartLabel = this.theme().greenDim;
        break;
      case "pink":
        colors.valueLine = this.theme().pinkDim;
        colors.valueFill = this.theme().pinkDimmer;
        colors.averageLine = this.theme().pink;
        colors.averageFill = this.theme().pink;
        colors.chartValue = this.theme().pink;
        colors.averageChartLine = this.theme().pinkDim;
        colors.chartLabel = this.theme().pinkDim;
        break;
      case "orange":
        colors.valueLine = this.theme().orangeDim;
        colors.valueFill = this.theme().orangeDimmer;
        colors.averageLine = this.theme().orange;
        colors.averageFill = this.theme().orange;
        colors.chartValue = this.theme().orange;
        colors.averageChartLine = this.theme().orangeDim;
        colors.chartLabel = this.theme().orangeDim;
        break;
      case "purple":
        colors.valueLine = this.theme().purpleDim;
        colors.valueFill = this.theme().purpleDimmer;
        colors.averageLine = this.theme().purple;
        colors.averageFill = this.theme().purple;
        colors.chartValue = this.theme().purple;
        colors.averageChartLine = this.theme().purpleDim;
        colors.chartLabel = this.theme().purpleDim;
        break;
      case "grey":
        colors.valueLine = this.theme().greyDim;
        colors.valueFill = this.theme().greyDimmer;
        colors.averageLine = this.theme().grey;
        colors.averageFill = this.theme().grey;
        colors.chartValue = this.theme().grey;
        colors.averageChartLine = this.theme().greyDim;
        colors.chartLabel = this.theme().greyDim;
        break;
      case "yellow":
        colors.valueLine = this.theme().yellowDim;
        colors.valueFill = this.theme().yellowDimmer;
        colors.averageLine = this.theme().yellow;
        colors.averageFill = this.theme().yellow;
        colors.chartValue = this.theme().yellow;
        colors.averageChartLine = this.theme().yellowDim;
        colors.chartLabel = this.theme().yellowDim;
        break;
    }
    return colors;
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this._dsServiceSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
    this.chart?.destroy();
  }
}
