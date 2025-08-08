import { IDatasetServiceDatasetConfig, TimeScaleFormat } from '../../core/services/data-set.service';
import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, viewChild, inject, effect, NgZone } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle, ChartArea, Scale } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle);

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
  y: number,     // age in ms (computed each update), or temporary ts at insert
  ts?: number    // original timestamp in ms, used to recompute age
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
  private xCenter: number | null = null;
  private xStep: number | null = null;
  private centerTickPlugin = {
    id: 'centerTickStyle',
    afterDraw: (chart) => {
      const xScale = chart.scales?.x as (Scale | undefined);
      if (!xScale) return;
      const scales = chart.options?.scales as { x?: { min?: number; max?: number } } | undefined;
      const xMin = scales?.x?.min;
      const xMax = scales?.x?.max;
      if (typeof xMin !== 'number' || typeof xMax !== 'number') return;
      const center = (xMin + xMax) / 2;
      const px = xScale.getPixelForValue(center);
      const ctx = chart.ctx as CanvasRenderingContext2D;
      // Draw the center line on top of datasets
      const area = chart.chartArea as ChartArea;
      ctx.save();
      ctx.strokeStyle = this.theme().contrastDim;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, area.top);
      ctx.lineTo(px, area.bottom);
      ctx.stroke();
      ctx.restore();
      const wrapped = ((center % 360 + 360) % 360);
      const label = `${wrapped.toFixed(0)}°`;
      ctx.save();
      ctx.fillStyle = this.theme().contrastDim;
      const def = Chart.defaults.font;
      ctx.font = `bold ${22}px ${def.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // Place the label relative to the axis position
      const position = (xScale.options as { position?: string })?.position;
      const y = position === 'top' ? (xScale.top + 4) : (xScale.bottom + 2);
      ctx.fillText(label, px, y);
      ctx.restore();
    }
  };

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
    // this.testSimulateCrossingZero();
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
          options: this.lineChartOptions,
          plugins: [this.centerTickPlugin]
        });
      } else {
        this.ngZone.runOutsideAngular(() => {
          this.chart?.update('quiet');
        });
      }

      this.startStreaming();
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
        type: "linear",
        display: true,
        position: "right",
        reverse: true, // 0 (now) at top; older increases downward
        title: {
          display: true,
          text: `${this.datasetConfig.timeScaleFormat}`,
          align: "center"
        },
        ticks: {
          count: 7,            // 7 lines including start/end
          autoSkip: false,
          includeBounds: true,
          align: 'inner',
          major: { enabled: true },
          font: { size: 16 },
          callback: (value: number) => {
            const ms = Number(value);
            const fmt = this.datasetConfig?.timeScaleFormat;
            const windowMs = this.getWindowMs(fmt);
            // Special formatting for 5-minute scale: mm:ss
            if (fmt === 'Last 5 Minutes') {
              const m = Math.floor(ms / 60_000);
              const s = Math.round((ms % 60_000) / 1000);
              const ss = s.toString().padStart(2, '0');
              return `${m}:${ss}`;
            }
            // >= 10 minutes → minutes; else seconds
            if (windowMs >= 10 * 60_000) {
              const m = Math.round(ms / 60_000);
              return `${m}'`;
            }
            const s = Math.round(ms / 1000);
            return `${s}"`;
          }
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
        bounds: 'ticks',
        // min/max will be set dynamically in updateChartAfterDataChange
        title: { display: false },
        ticks: {
          count: 5,
          autoSkip: false,
          includeBounds: true,
          callback: (value: number) => {
            // Hide the default center tick label; plugin will draw a bold themed label there
            const center = this.xCenter ?? Number.NaN;
            const step = this.xStep ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            if (Number.isFinite(center) && Math.abs(value - center) <= tol) return '';
            const wrapped = ((value % 360 + 360) % 360);
            return `${wrapped.toFixed(0)}°`;
          },
          // Make the center tick bold and themed using precomputed midpoint/step
          font: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number } }).tick?.value ?? Number.NaN;
            const center = this.xCenter ?? Number.NaN;
            const step = this.xStep ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isCenter = Number.isFinite(tickVal) && Number.isFinite(center) && Math.abs(tickVal - center) <= tol;
            return { size: 20, weight: isCenter ? 'bold' : 'normal' };
          },
          color: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number } }).tick?.value ?? Number.NaN;
            const center = this.xCenter ?? Number.NaN;
            const step = this.xStep ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isCenter = Number.isFinite(tickVal) && Number.isFinite(center) && Math.abs(tickVal - center) <= tol;
            return isCenter ? this.theme().contrast : undefined;
          },
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer,
          lineWidth: 1
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
        font: { size: 35 },
        color: this.getThemeColors().chartLabel
      },
      annotation : {
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

 /*  public testSimulateCrossingZero(): void {
    // Generate 30 seconds of oscillating wind direction crossing 0° back and forth
    const points = 30;
    const startTs = Date.now() - (points - 1) * 1000; // 1-second increments
    const toRad = (d: number) => d * Math.PI / 180;
    const amplitudeDeg = 20;           // +/- 20° swing around 0
    const periodSec = 12;              // oscillation period
    const noiseDeg = 2;                // jitter for value around SMA
    const windowSize = 5;              // rolling window for SMA/min/max

    // Base oscillation in degrees (centered around 0°), then unwrap for continuity
    const baseDegSeq = Array.from({ length: points }, (_, i) =>
      amplitudeDeg * Math.sin((2 * Math.PI * i) / periodSec)
    );
    const degUnwrapped = this.unwrapAngles(baseDegSeq);

    const testData: IDatasetServiceDatapoint[] = degUnwrapped.map((deg, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const window = degUnwrapped.slice(start, i + 1);
      const avgDeg = window.reduce((s, v) => s + v, 0) / window.length;
      const minDeg = Math.min(...window);
      const maxDeg = Math.max(...window);
      // Slight variation of value from SMA
      const jitter = (Math.random() * 2 - 1) * noiseDeg; // [-noiseDeg, +noiseDeg]
      const valueDeg = avgDeg + jitter;

      return {
        timestamp: startTs + i * 1000,
        data: {
          value: toRad(valueDeg),
          sma: toRad(avgDeg),
          lastAverage: 0,             // fixed 0 rad as requested
          lastMinimum: toRad(minDeg),
          lastMaximum: toRad(maxDeg)
        }
      };
    });

    this.createDatasets();
    this.pushRowsToDatasets(testData);
    this.updateChartAfterDataChange();
    this.ngZone.runOutsideAngular(() => {
    this.chart?.update();
    });
  } */

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
      y: row.timestamp, // temporarily store timestamp; converted to age in updateChartAfterDataChange
      ts: row.timestamp,
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
    // Force equal spacing: 5 ticks means 4 intervals
    const xMin = this.chart.options.scales.x.min as number;
    const xMax = this.chart.options.scales.x.max as number;
    const step = (xMax - xMin) / 4;
    const xScale = this.chart.options.scales as unknown as { x: { ticks?: { stepSize?: number } } };
    xScale.x.ticks = { ...(xScale.x.ticks ?? {}), stepSize: step };
  // cache for tick styling
  this.xCenter = (xMin + xMax) / 2;
  this.xStep = step;

    // Fixed, non-scrolling y-axis window (relative age)
    const windowMs = this.getWindowMs(this.datasetConfig?.timeScaleFormat);
    const data0 = this.chart.data.datasets[0].data as (IDataSetRow[]);
    if (data0.length > 0) {
      const lastTs = data0[data0.length - 1]?.ts ?? data0[data0.length - 1]?.y;
      // Recompute y for all datasets as age (ms) relative to lastTs
      this.chart.data.datasets.forEach(ds => {
        (ds.data as IDataSetRow[]).forEach(p => {
          const ts = p.ts ?? p.y;
          p.y = Math.max(0, Math.min(windowMs, (lastTs as number) - ts));
        });
      });
      // Lock y scale to [0, window]
      this.chart.options.scales.y.min = 0;
      this.chart.options.scales.y.max = windowMs;
      // 7 ticks => 6 intervals
      const step = windowMs / 6;
      const yScale = this.chart.options.scales as unknown as { y: { ticks?: { stepSize?: number } } };
      yScale.y.ticks = { ...(yScale.y.ticks ?? {}), stepSize: step };
    }

  // removed annotation averageLine updates
  }

  private getWindowMs(fmt: TimeScaleFormat | undefined): number {
    switch (fmt) {
      case 'Last 30 Minutes':
        return 30 * 60_000;
      case 'Last 5 Minutes':
        return 5 * 60_000;
      case 'Last Minute':
        return 60_000;
      default:
        return 60_000; // fallback 1 minute
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
