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
  private _dsDirectionSub: Subscription = null;
  private _dsSpeedSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo = null;
  private xCenter: number | null = null;
  private xStep: number | null = null;
  private xCenterSpeed: number | null = null;
  private xStepSpeed: number | null = null;
  // Paint background under grid lines (chartArea only) so it appears beneath grids
  private gridBackgroundPlugin = {
    id: 'xSpeedGridBackground',
    beforeDraw: (chart: Chart) => {
      const area = chart.chartArea as ChartArea | undefined;
      if (!area) return;
      const ctx = chart.ctx as CanvasRenderingContext2D;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = this.theme().background;
      // Fill exactly the plotting area where grid lines are drawn
      ctx.fillRect(area.left, area.top, area.width / 2, area.height);
      ctx.restore();
    }
  };
  private centerTickPlugin = {
    id: 'centerTickStyle',
    afterDraw: (chart) => {
      const ctx = chart.ctx as CanvasRenderingContext2D;
      const area = chart.chartArea as ChartArea;

      // Loading overlay until we have enough data to draw nicely
      const dirVals = chart.data?.datasets?.[0]?.data as (IDataSetRow[] | undefined);
      const spdVals = chart.data?.datasets?.[5]?.data as (IDataSetRow[] | undefined);
      const ready = (dirVals?.length ?? 0) >= 2 && (spdVals?.length ?? 0) >= 2;
      if (!ready) {
        ctx.save();
        // Draw centered message box within the plotting area
        const boxW = Math.min(area.width * 0.7, 420);
        const boxH = 90;
        const x = area.left + (area.width - boxW) / 2;
        const y = area.top + (area.height - boxH) / 2;
        // Background
        ctx.fillStyle = this.theme().background;
        ctx.fillRect(x, y, boxW, boxH);
        // Border
        ctx.strokeStyle = this.theme().contrastDim;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxW, boxH);
        // Text
        const def = Chart.defaults.font;
        ctx.fillStyle = this.getThemeColors().chartLabel;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 22px ${def.family}`;
        ctx.fillText('Data acquisition in progress...', x + boxW / 2, y + boxH / 2);
        ctx.restore();
        return; // Skip other drawings until ready
      }

      const drawForAxis = (axisKey: 'x' | 'xSpeed', format: (v: number) => string) => {
        const scale = chart.scales?.[axisKey] as (Scale | undefined);
        const scales = chart.options?.scales as Record<string, { min?: number; max?: number }> | undefined;
        if (!scale) return;
        // Use configured min/max if present, else fall back to built scale bounds
        const sAny = scale as unknown as { min?: number; max?: number };
        const min = (scales?.[axisKey]?.min as number | undefined) ?? sAny.min;
        const max = (scales?.[axisKey]?.max as number | undefined) ?? sAny.max;
        if (typeof min !== 'number' || typeof max !== 'number' || !isFinite(min) || !isFinite(max)) return;
        const center = (min + max) / 2;
        const px = scale.getPixelForValue(center);
        ctx.save();
        ctx.strokeStyle = this.theme().contrastDim;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px, area.top);
        ctx.lineTo(px, area.bottom);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = this.theme().contrastDim;
        const def = Chart.defaults.font;
        ctx.font = `bold ${22}px ${def.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const position = (scale.options as { position?: string })?.position;
        const y = position === 'top' ? (scale.top + 4) : (scale.bottom + 2);
        ctx.fillText(format(center), px, y);
        ctx.restore();
      };

      drawForAxis('x', (v) => `${(((v % 360) + 360) % 360).toFixed(0)}°`);
      drawForAxis('xSpeed', (v) => `${v.toFixed(1)}`);

      // Draw xSpeed rightmost tick label shifted 10px left
      const xSpeedScale = (chart.scales?.['xSpeed'] as (Scale | undefined));
      if (xSpeedScale) {
        const scales = chart.options?.scales as Record<string, { min?: number; max?: number }> | undefined;
        const sAny = xSpeedScale as unknown as { min?: number; max?: number };
        const xmax = (scales?.['xSpeed']?.max as number | undefined) ?? sAny.max;
        if (typeof xmax === 'number' && isFinite(xmax)) {
          const px = xSpeedScale.getPixelForValue(xmax);
          const def = Chart.defaults.font;
          ctx.save();
          // Match tick label color for xSpeed axis
          const tickColorOptSpd = (xSpeedScale.options as unknown as { ticks?: { color?: string | ((ctx: { chart: Chart; scale: Scale; tick: { value: number } }) => string | undefined) } }).ticks?.color;
          const spdColor = typeof tickColorOptSpd === 'function'
            ? (tickColorOptSpd as (ctx: { chart: Chart; scale: Scale; tick: { value: number } }) => string | undefined)({ chart, scale: xSpeedScale, tick: { value: xmax } }) ?? Chart.defaults.color
            : (typeof tickColorOptSpd === 'string' ? tickColorOptSpd : Chart.defaults.color);
          ctx.fillStyle = spdColor as string;
          ctx.font = `normal ${20}px ${def.family}`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          const y = (xSpeedScale.options as { position?: string })?.position === 'top' ? (xSpeedScale.top + 4) : (xSpeedScale.bottom + 2);
          const step = this.xStepSpeed ?? 1;
          const dp = Math.max(0, Math.min(3, Math.ceil(-Math.log10(step))));
          ctx.fillText(`${xmax.toFixed(dp)}`, px - 5, y);
          ctx.restore();

          // Extend the rightmost xSpeed tick vertical line 10px above the top time scale line
          ctx.save();
          ctx.strokeStyle = this.theme().contrastDim;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const xLine = Math.round(px) + 0.5;
          ctx.moveTo(xLine, area.bottom);
          ctx.lineTo(xLine, area.top - 42);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw x leftmost tick label shifted 5px right
      const xScale = (chart.scales?.['x'] as (Scale | undefined));
      if (xScale) {
        const scales = chart.options?.scales as Record<string, { min?: number; max?: number }> | undefined;
        const sAny = xScale as unknown as { min?: number; max?: number };
        const xmin = (scales?.['x']?.min as number | undefined) ?? sAny.min;
        if (typeof xmin === 'number' && isFinite(xmin)) {
          const px = xScale.getPixelForValue(xmin);
          const def = Chart.defaults.font;
          ctx.save();
          // Match tick label color for x axis
          const tickColorOptDir = (xScale.options as unknown as { ticks?: { color?: string | ((ctx: { chart: Chart; scale: Scale; tick: { value: number } }) => string | undefined) } }).ticks?.color;
          const dirColor = typeof tickColorOptDir === 'function'
            ? (tickColorOptDir as (ctx: { chart: Chart; scale: Scale; tick: { value: number } }) => string | undefined)({ chart, scale: xScale, tick: { value: xmin } }) ?? Chart.defaults.color
            : (typeof tickColorOptDir === 'string' ? tickColorOptDir : Chart.defaults.color);
          ctx.fillStyle = dirColor as string;
          ctx.font = `normal ${20}px ${def.family}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const y = (xScale.options as { position?: string })?.position === 'top' ? (xScale.top + 4) : (xScale.bottom + 2);
          const wrapped = this.normalizeAngle(xmin);
          ctx.fillText(`${wrapped.toFixed(0)}°`, px + 5, y);
          ctx.restore();
        }
      }

      // Top-right speed value
      const ds = chart.data?.datasets as unknown as { label?: string; data: IDataSetRow[] }[];
      const speedVal = ds?.[5]?.data; // first speed dataset index (see dataset order)
      const last = speedVal?.length ? speedVal.length - 1 : -1;
      const lastSpeed = last >= 0 ? speedVal[last]?.x : undefined;

      if (typeof lastSpeed === 'number' && isFinite(lastSpeed)) {
        ctx.save();
        ctx.fillStyle = this.getThemeColors().chartValue;
        const def = Chart.defaults.font;
        // Draw speed value centered
        ctx.font = `bold 62px ${def.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const speedText = `${lastSpeed.toFixed(1)}`;
        const speedX = area.left + (area.width / 4);
        const speedY = area.top - 62;
        ctx.fillText(speedText, speedX, speedY);
        // Measure speed text to place unit right after it
        const metrics = ctx.measureText(speedText);
        const padding = 8; // px spacing between value and unit
        const unitX = speedX + (metrics.width / 2) + padding;
        const unitY = area.top - 51;
        ctx.font = `bold 28px ${def.family}`;
        ctx.textAlign = 'left';
        ctx.fillText('kts', unitX, unitY);
        ctx.restore();
      }

      // Top direction value
      const dirVal = ds?.[0]?.data; // first direction dataset index
      const lastDirIdx = dirVal?.length ? dirVal.length - 1 : -1;
      const lastDir = lastDirIdx >= 0 ? dirVal[lastDirIdx]?.x : undefined;
      if (typeof lastDir === 'number' && isFinite(lastDir)) {
        const dir = this.normalizeAngle(lastDir);
        ctx.save();
        ctx.fillStyle = this.getThemeColors().chartValue;
        const def = Chart.defaults.font;
        ctx.font = `bold 62px ${def.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${dir.toFixed(0)}°`, area.left + (3 * area.width / 4), area.top - 62);
        ctx.restore();
      }
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
    this.datasetConfig = this._dataset.getDatasetConfig(`${this.widgetProperties.uuid}-twd`);
    this.dataSourceInfo = this._dataset.getDataSourceInfo(`${this.widgetProperties.uuid}-twd`);

    if (this.datasetConfig) {
      this.createDatasets();
      this.setChartOptions();

      if (!this.chart) {
          this.chart = new Chart(this.widgetDataChart().nativeElement.getContext('2d'), {
          type: this.lineChartType,
          data: this.lineChartData,
          options: this.lineChartOptions,
            plugins: [this.gridBackgroundPlugin, this.centerTickPlugin]
        });
        // Render once so initial axes and plugin drawings appear before data
        this.ngZone.runOutsideAngular(() => {
          this.chart?.update();
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
    // remove dataset if they exists and recreate
    if (this._dataset.list().filter(ds => ds.uuid === `${this.widgetProperties.uuid}-twd`).length === 0) {
      this._dataset.remove(`${this.widgetProperties.uuid}-twd`);
    }
    if (this._dataset.list().filter(ds => ds.uuid === `${this.widgetProperties.uuid}-tws`).length === 0) {
      this._dataset.remove(`${this.widgetProperties.uuid}-tws`);
    }
    this.createServiceDataset();
    this.startWidget();
  }

  private createServiceDataset(): void {
    if (this.widgetProperties.config.timeScale === '') return;
    const pathDirection = "self.environment.wind.directionTrue";
    //TODO: Remove testing line environment.wind.speedOverGround
    //const pathSpeed = "self.environment.wind.speedTrue";
    const pathSpeed = "self.environment.wind.speedOverGround";
    const source = "default";

    // Create datasets if it does not exist
    if (this._dataset.list().filter(ds => ds.uuid === `${this.widgetProperties.uuid}-twd`).length === 0) {
      this._dataset.create(pathDirection, source, this.widgetProperties.config.timeScale as TimeScaleFormat, 30, `windtrends-${this.widgetProperties.uuid}`, true, false, `${this.widgetProperties.uuid}-twd`);
    }

    if (this._dataset.list().filter(ds => ds.uuid === `${this.widgetProperties.uuid}-tws`).length === 0) {
      this._dataset.create(pathSpeed, source, this.widgetProperties.config.timeScale as TimeScaleFormat, 30, `speedtrends-${this.widgetProperties.uuid}`, true, false, `${this.widgetProperties.uuid}-tws`);
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = 'y';

  // Provide initial x (direction) range so ticks/center line render before data arrives
  const xDefaultMin = 0;
  const xDefaultMax = 360;
  const xDefaultStep = (xDefaultMax - xDefaultMin) / 4; // 5 ticks
  // Provide initial xSpeed (knots) range as well
  const xsDefaultMin = 0;
  const xsDefaultMax = 20;
  const xsDefaultStep = (xsDefaultMax - xsDefaultMin) / 4; // 5 ticks

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
          count: 6,            // 6 lines including start/end
          autoSkip: false,
          includeBounds: true,
          align: 'inner',
          major: { enabled: true },
          font: { size: 16 },
          callback: (value: number) => {
            const ms = Number(value);
            const fmt = this.datasetConfig?.timeScaleFormat;
            const windowMs = this.getWindowMs(fmt);
            // 5-minute scale: show whole minutes
            if (fmt === 'Last 5 Minutes') {
              const m = Math.round(ms / 60_000);
              return `${m}'`;
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
        stack: 'trends',
        beginAtZero: false,
        bounds: 'ticks',
        min: xDefaultMin,
        max: xDefaultMax,
        // min/max will be set dynamically in updateChartAfterDataChange
        title: { display: false },
        ticks: {
          count: 5,
          align: 'inner',
          autoSkip: false,
          includeBounds: true,
          stepSize: xDefaultStep,
          minRotation: 0,
          maxRotation: 0,
          callback: (value: number) => {
            // Hide the default center tick label; plugin will draw a bold themed label there
            const center = this.xCenter ?? Number.NaN;
            const step = this.xStep ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            if (Number.isFinite(center) && Math.abs(value - center) <= tol) return '';
            // Hide leftmost label (at min) to avoid overlap with custom shifted label
            const scales = this.chart?.options?.scales as unknown as { x?: { min?: number } } | undefined;
            const minOpt = scales?.x?.min;
            if (typeof minOpt === 'number' && isFinite(minOpt) && Math.abs((value as number) - minOpt) <= tol) return '';
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
          color: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number }, scale: Scale }).tick?.value ?? Number.NaN;
            const scale = (ctx as unknown as { scale: Scale }).scale;
            const scales = this.chart?.options?.scales as unknown as { x?: { min?: number } } | undefined;
            const sAny = scale as unknown as { min?: number };
            const min = (scales?.x?.min as number | undefined) ?? sAny.min;
            const step = this.xStep ?? 1;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isMin = Number.isFinite(tickVal) && Number.isFinite(min) && Math.abs(tickVal - (min as number)) <= tol;
            return isMin ? 'rgba(0,0,0,0)' : this.theme().contrastDimmer;
          },
          lineWidth: 1
        }
      },
      xSpeed: {
        type: "linear",
        position: "top",
        stack: 'trends',
        beginAtZero: false,
        bounds: 'ticks',
        min: xsDefaultMin,
        max: xsDefaultMax,
        title: { display: false },
        ticks: {
          count: 5,
          align: 'inner',
          autoSkip: false,
          includeBounds: true,
          stepSize: xsDefaultStep,
          minRotation: 0,
          maxRotation: 0,
          callback: (value: number) => {
            const center = this.xCenterSpeed ?? Number.NaN;
            const step = this.xStepSpeed ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            if (Number.isFinite(center) && Math.abs((value as number) - center) <= tol) return '';
            // Hide rightmost label (at max) to avoid overlap with custom shifted label
            const scales = this.chart?.options?.scales as unknown as { xSpeed?: { max?: number } } | undefined;
            const maxOpt = scales?.xSpeed?.max;
            if (typeof maxOpt === 'number' && isFinite(maxOpt) && Math.abs((value as number) - maxOpt) <= tol) return '';
            // Derive decimals from step so adjacent ticks remain distinct
            const s = Number.isFinite(step) ? step : 1;
            const dp = Math.max(0, Math.min(3, Math.ceil(-Math.log10(s))));
            return `${(value as number).toFixed(dp)}`;
          },
          font: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number } }).tick?.value ?? Number.NaN;
            const center = this.xCenterSpeed ?? Number.NaN;
            const step = this.xStepSpeed ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isCenter = Number.isFinite(tickVal) && Number.isFinite(center) && Math.abs(tickVal - center) <= tol;
            return { size: 20, weight: isCenter ? 'bold' : 'normal' };
          },
          color: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number } }).tick?.value ?? Number.NaN;
            const center = this.xCenterSpeed ?? Number.NaN;
            const step = this.xStepSpeed ?? Number.NaN;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isCenter = Number.isFinite(tickVal) && Number.isFinite(center) && Math.abs(tickVal - center) <= tol;
            return isCenter ? this.theme().contrast : undefined;
          },
        },
        grid: {
          display: true,
          color: (ctx) => {
            const tickVal = (ctx as unknown as { tick?: { value: number }, scale: Scale }).tick?.value ?? Number.NaN;
            const scale = (ctx as unknown as { scale: Scale }).scale;
            const scales = this.chart?.options?.scales as unknown as { xSpeed?: { max?: number } } | undefined;
            const sAny = scale as unknown as { max?: number };
            const max = (scales?.xSpeed?.max as number | undefined) ?? sAny.max;
            const step = this.xStepSpeed ?? 1;
            const tol = Number.isFinite(step) ? Math.max(1e-6, step * 0.25) : 1e-6;
            const isMax = Number.isFinite(tickVal) && Number.isFinite(max) && Math.abs(tickVal - (max as number)) <= tol;
            return isMax ? 'rgba(0,0,0,0)' : this.theme().contrastDimmer;
          },
          lineWidth: 1
        }
      }
    };

    this.lineChartOptions.plugins = {
      title: {
        display: true,
        align: "end",
        padding: { top: 3, bottom: 0 },
        text: `TWD `,
        font: { size: 35, weight: 'normal' },
        color: this.getThemeColors().chartLabel
      },
      subtitle: {
        display: true,
        align: "start",
        padding: { top: -41, bottom: 12 },
        text: ` TWS`,
        font: { size: 35 },
        color: this.getThemeColors().chartLabel
      },
      annotation : {
      },
      legend: { display: false }
    }

    // Cache initial centers/steps for tick styling before first data update
    this.xCenter = (xDefaultMin + xDefaultMax) / 2;
    this.xStep = xDefaultStep;
    this.xCenterSpeed = (xsDefaultMin + xsDefaultMax) / 2;
    this.xStepSpeed = xsDefaultStep;
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
        xAxisID: 'x'
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
          const chart = context.chart as Chart;
          const { ctx } = chart;
          return this.lineGradientForAxis(ctx, chart, 'x');
        },
        backgroundColor: 'red',
        xAxisID: 'x'
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
        xAxisID: 'x'
      },
      {
        label: 'lastMinimum',
        data: [],
        order: 3,
        parsing: false,
        normalized: true,
        hidden: true,
        xAxisID: 'x'
      },
      {
        label: 'lastMaximum',
        data: [],
        order: 4,
        parsing: false,
        normalized: true,
        hidden: true,
        xAxisID: 'x'
      },
      // Speed datasets (5..9)
      {
        label: 'Value Speed',
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
        xAxisID: 'xSpeed'
      },
      {
        label: 'SMA Speed',
        data: [],
        order: 0,
        parsing: false,
        normalized: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 3,
        fill: false,
        borderColor: (context) => {
          const chart = context.chart as Chart;
          const { ctx } = chart;
          return this.lineGradientForAxis(ctx, chart, 'xSpeed');
        },
        xAxisID: 'xSpeed'
      },
      {
        label: 'lastAverage Speed',
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
        xAxisID: 'xSpeed'
      },
      {
        label: 'lastMinimum Speed',
        data: [],
        order: 3,
        parsing: false,
        normalized: true,
        hidden: true,
        xAxisID: 'xSpeed'
      },
      {
        label: 'lastMaximum Speed',
        data: [],
        order: 4,
        parsing: false,
        normalized: true,
        hidden: true,
        xAxisID: 'xSpeed'
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
    this._dsDirectionSub?.unsubscribe();
    this._dsSpeedSub?.unsubscribe();

    const batchThenLiveDir$ = this._dataset.getDatasetBatchThenLiveObservable(`${this.widgetProperties.uuid}-twd`);
    const batchThenLiveSpd$ = this._dataset.getDatasetBatchThenLiveObservable(`${this.widgetProperties.uuid}-tws`);

    this._dsDirectionSub = batchThenLiveDir$?.subscribe(dsPointOrBatch => {
      if (Array.isArray(dsPointOrBatch)) {
        this.pushRowsToDatasets(dsPointOrBatch);
      } else {
        this.pushRowsToDatasets([dsPointOrBatch]);
        if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          for (let i = 0; i <= 4; i++) this.chart.data.datasets[i].data.shift();
        }
      }
      this.updateChartAfterDataChange();
      this.ngZone.runOutsideAngular(() => { this.chart?.update('quiet'); });
    });

    this._dsSpeedSub = batchThenLiveSpd$?.subscribe(dsPointOrBatch => {
      if (Array.isArray(dsPointOrBatch)) {
        this.pushRowsToSpeedDatasets(dsPointOrBatch);
      } else {
        this.pushRowsToSpeedDatasets([dsPointOrBatch]);
        if (this.chart.data.datasets[5].data.length > this.dataSourceInfo.maxDataPoints) {
          for (let i = 5; i <= 9; i++) this.chart.data.datasets[i].data.shift();
        }
      }
      this.updateChartAfterDataChange();
      this.ngZone.runOutsideAngular(() => { this.chart?.update('quiet'); });
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

  private pushRowsToSpeedDatasets(rows: IDatasetServiceDatapoint[]): void {
    this.chart.data.datasets[5].data.push(...this.transformSpeedRows(rows, 'value'));
    this.chart.data.datasets[6].data.push(...this.transformSpeedRows(rows, 'sma'));
    this.chart.data.datasets[7].data.push(...this.transformSpeedRows(rows, 'avg'));
    this.chart.data.datasets[8].data.push(...this.transformSpeedRows(rows, 'min'));
    this.chart.data.datasets[9].data.push(...this.transformSpeedRows(rows, 'max'));
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

  private transformSpeedRows(rows: IDatasetServiceDatapoint[], datasetType: string): IDataSetRow[] {
    const vals = rows.map(row => {
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
      return v == null ? null : this.unitsService.convertToUnit("knots", v);
    });

    return rows.map((row, idx) => ({
      x: vals[idx],
      y: row.timestamp,
      ts: row.timestamp,
    }));
  }

  private normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  // Minimal absolute angular distance in degrees [0, 180]
  private angularDiff(a: number, b: number): number {
    const d = ((a - b + 540) % 360) - 180; // [-180, 180)
    return Math.abs(d);
  }

  // Compute a "nice" step size close to the requested step using 1/2/2.5/5 * 10^n
  private niceStep(step: number): number {
    if (!isFinite(step) || step <= 0) return 1;
    const exp = Math.floor(Math.log10(step));
    const base = step / Math.pow(10, exp);
    let niceBase: number;
    if (base <= 1) niceBase = 1;
    else if (base <= 2) niceBase = 2;
    else if (base <= 2.5) niceBase = 2.5;
    else if (base <= 5) niceBase = 5;
    else niceBase = 10;
    return niceBase * Math.pow(10, exp);
  }

  // More flexible: choose from provided mantissas (ascending) for a nice step
  private niceStepFromMantissas(step: number, mantissas: number[]): number {
    if (!isFinite(step) || step <= 0) return 1;
    const exp = Math.floor(Math.log10(step));
    const base = step / Math.pow(10, exp);
    const chosen = mantissas.find(m => base <= m) ?? mantissas[mantissas.length - 1];
    return chosen * Math.pow(10, exp);
  }

  private updateChartAfterDataChange() {
  // Update Title value (no-op here; axis ranges computed below)

    // Calculate dynamic x (direction) scale range based on lastAverage center and lastMin/Max distances (with wrap-around)
    const dirAvgArr = this.chart.data.datasets[2]?.data as IDataSetRow[] | undefined;
    const dirSmaArr = this.chart.data.datasets[1]?.data as IDataSetRow[] | undefined;
    const dirValArr = this.chart.data.datasets[0]?.data as IDataSetRow[] | undefined;
    const hasAvg = !!dirAvgArr?.length;
    const hasSma = !!dirSmaArr?.length;
    const hasVal = !!dirValArr?.length;
    // Center MUST be the latest lastAverage value when available, else fall back to SMA, else Value
      const centerVal = hasAvg
        ? dirAvgArr![dirAvgArr!.length - 1].x
        : hasSma
          ? dirSmaArr![dirSmaArr!.length - 1].x
          : hasVal
            ? dirValArr![dirValArr!.length - 1].x
            : undefined;
    if (typeof centerVal === 'number' && isFinite(centerVal)) {
      // Try to use lastMinimum/Maximum if available; else derive half-range from recent window using angular distance
      const minDs = this.chart.data.datasets[3]?.data as IDataSetRow[] | undefined;
      const maxDs = this.chart.data.datasets[4]?.data as IDataSetRow[] | undefined;
      const lastMin = minDs?.length ? minDs[minDs.length - 1].x : undefined;
      const lastMax = maxDs?.length ? maxDs[maxDs.length - 1].x : undefined;
  const minDiff = typeof lastMin === 'number' && isFinite(lastMin) ? this.angularDiff(centerVal, lastMin) : Number.NaN;
  const maxDiff = typeof lastMax === 'number' && isFinite(lastMax) ? this.angularDiff(centerVal, lastMax) : Number.NaN;
      let halfRange = Number.isFinite(minDiff) || Number.isFinite(maxDiff)
        ? Math.max(Number.isFinite(minDiff) ? minDiff : 0, Number.isFinite(maxDiff) ? maxDiff : 0)
        : Number.NaN;
      if (!Number.isFinite(halfRange)) {
        const src = hasAvg ? dirAvgArr! : hasSma ? dirSmaArr! : dirValArr!;
        const take = Math.min(30, src?.length ?? 0);
        if (take > 1) {
          const slice = src!.slice(src!.length - take);
          const xs = slice.map(p => p.x).filter(v => typeof v === 'number' && isFinite(v)) as number[];
          if (xs.length) {
            halfRange = xs.reduce((m, v) => Math.max(m, this.angularDiff(centerVal, v)), 0);
          }
        }
      }
      // Ensure a sensible minimum half-range so the axis doesn't collapse on first point
      const minHalfRangeDeg = 15; // shows a 30° window initially
      halfRange = Math.max(halfRange || 0, minHalfRangeDeg);
      // 5 ticks (4 intervals) with a nice step, snapped to grid around the chosen center
      const requestedStep = (2 * halfRange) / 4; // = halfRange / 2
  // Allow 15° by including 1.5 mantissa; also support 7.5
  const dStep = this.niceStepFromMantissas(requestedStep, [1, 1.5, 2, 2.5, 5, 7.5, 10]);
        // Do NOT snap the center; place it exactly at lastAverage
        const xMin = centerVal - 2 * dStep;
        const xMax = centerVal + 2 * dStep;
      this.chart.options.scales.x.min = xMin;
      this.chart.options.scales.x.max = xMax;
      const xScale = this.chart.options.scales as unknown as { x: { ticks?: { stepSize?: number } } };
      xScale.x.ticks = { ...(xScale.x.ticks ?? {}), stepSize: dStep };

      // cache for tick styling
        this.xCenter = centerVal;
      this.xStep = dStep;
    }

    // Calculate dynamic xSpeed (knots) scale range based on lastAverage center and lastMin/Max distances
    const sAvgArr = this.chart.data.datasets[7]?.data as IDataSetRow[] | undefined;
    if (sAvgArr && sAvgArr.length) {
      const sIdx = sAvgArr.length - 1;
      const sAvg = sAvgArr[sIdx]?.x ?? 0;
      const sMin = (this.chart.data.datasets[8].data as IDataSetRow[])[sIdx]?.x ?? sAvg;
      const sMax = (this.chart.data.datasets[9].data as IDataSetRow[])[sIdx]?.x ?? sAvg;
      const sDiffMin = Math.abs(sAvg - sMin);
      const sDiffMax = Math.abs(sMax - sAvg);
      let halfRangeS = Math.max(sDiffMin, sDiffMax);
      // Guard minimum half-range to avoid collapse
      const minHalfRangeS = 0.5; // knots
      halfRangeS = Math.max(halfRangeS, minHalfRangeS);
      // Target 5 ticks (4 intervals) with a nice step (ceiling)
      const requestedStep = (2 * halfRangeS) / 4; // = halfRangeS / 2
      // Preserve previous speed behavior (no 1.5/7.5 mantissas)
      const spStep = this.niceStepFromMantissas(requestedStep, [1, 2, 2.5, 5, 10]);
      // Keep center exactly at lastAverage Speed
      const spMin = sAvg - 2 * spStep;
      const spMax = sAvg + 2 * spStep;
      const scales = this.chart.options.scales as unknown as { xSpeed: { min?: number; max?: number; ticks?: { stepSize?: number } } };
      scales.xSpeed.min = spMin;
      scales.xSpeed.max = spMax;
      scales.xSpeed.ticks = { ...(scales.xSpeed.ticks ?? {}), stepSize: spStep };

      // cache for tick styling on speed axis
      this.xCenterSpeed = sAvg;
      this.xStepSpeed = spStep;
    }

    // Fixed, non-scrolling y-axis window (relative age)
    const windowMs = this.getWindowMs(this.datasetConfig?.timeScaleFormat);
    const data0 = this.chart.data.datasets[0].data as (IDataSetRow[]);
    if (data0.length > 0) {
      const nowTs = Date.now();
      // Recompute y for all datasets as age (ms) relative to now
      this.chart.data.datasets.forEach(ds => {
        (ds.data as IDataSetRow[]).forEach(p => {
          const ts = p.ts ?? p.y;
          p.y = Math.max(0, Math.min(windowMs, nowTs - ts));
        });
      });
      // Lock y scale to [0, window]
      this.chart.options.scales.y.min = 0;
      this.chart.options.scales.y.max = windowMs;
      // Explicit step per selected window
      let step: number;
      const fmt = this.datasetConfig?.timeScaleFormat;
      switch (fmt) {
        case 'Last Minute':
          step = 15_000; // 15 seconds
          break;
        case 'Last 5 Minutes':
          step = 60_000; // 1 minute
          break;
        case 'Last 30 Minutes':
          step = 5 * 60_000; // 5 minutes
          break;
        default:
          // fallback keeps 6 ticks => 5 intervals
          step = windowMs / 5;
          break;
      }
  const yScale = this.chart.options.scales as unknown as { y: { ticks?: { stepSize?: number; count?: number } } };
  const ticksCopy = { ...(yScale.y.ticks ?? {}) } as { stepSize?: number; count?: number };
  delete ticksCopy.count;
  ticksCopy.stepSize = step;
  yScale.y.ticks = ticksCopy;
    }
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

  private lineGradientForAxis(ctx: CanvasRenderingContext2D, chart: Chart, axisKey: 'x' | 'xSpeed'): CanvasGradient | null {
    const chartArea = chart.chartArea as ChartArea | undefined;
    if (!chartArea) return null;
    const scale = chart.scales?.[axisKey] as (Scale | undefined);
    if (!scale) return null;
    const scales = chart.options?.scales as Record<string, { min?: number; max?: number }> | undefined;
    const sAny = scale as unknown as { min?: number; max?: number };
    const min = (scales?.[axisKey]?.min as number | undefined) ?? sAny.min;
    const max = (scales?.[axisKey]?.max as number | undefined) ?? sAny.max;
    if (typeof min !== 'number' || typeof max !== 'number' || !isFinite(min) || !isFinite(max)) return null;
    const center = (min + max) / 2;
    const centerPx = scale.getPixelForValue(center);
    const offset = Math.max(0, Math.min(1, (centerPx - chartArea.left) / chartArea.width));
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, this.theme().port);
    gradient.addColorStop(offset, this.theme().port);
    gradient.addColorStop(offset, this.theme().starboard);
    gradient.addColorStop(1, this.theme().starboard);
    return gradient;
  }

  private setDatasetsColors(): void {
    this.lineChartData.datasets.forEach((dataset) => {
      if (dataset.label === 'Value') {
        dataset.borderColor = this.getThemeColors().valueLine;
        dataset.backgroundColor = this.getThemeColors().valueFill;
      }
      if (dataset.label === 'Value Speed') {
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
    this._dsDirectionSub?.unsubscribe();
    this._dsSpeedSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
    this.chart?.destroy();
  }
}
