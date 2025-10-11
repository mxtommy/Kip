import { IDatasetServiceDatasetConfig, TimeScaleFormat } from '../../core/services/data-set.service';
import { Component, OnDestroy, ElementRef, AfterViewInit, viewChild, inject, effect, NgZone, input, untracked, computed } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';
import { CanvasService } from '../../core/services/canvas.service';
import { UnitsService } from '../../core/services/units.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';

import { Chart, ChartConfiguration, ChartData, ChartType, TimeUnit, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle } from 'chart.js';
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
interface IDataSetRow { x: number, y: number }

@Component({
  selector: 'widget-data-chart',
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent implements AfterViewInit, OnDestroy {
  // Host2 functional inputs supplied by host container
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Host2 runtime directive (merged config)
  private readonly runtime = inject(WidgetRuntimeDirective);

  private readonly dsService = inject(DatasetService);
  private readonly ngZone = inject(NgZone);
  private readonly canvasService = inject(CanvasService);
  private readonly unitsService = inject(UnitsService);
  readonly widgetDataChart = viewChild('widgetDataChart', { read: ElementRef });

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Chart Label',
    color: 'contrast',
    filterSelfPaths: true,
    datachartPath: null,
    datachartSource: null,
    convertUnitTo: null,
    timeScale: 'minute', // second | minute | hour
    period: 10,
    numDecimal: 1,
    inverseYAxis: false,
    datasetAverageArray: 'sma', // sma | ema | dema | avg
    showAverageData: true,
    trackAgainstAverage: false,
    showDatasetMinimumValueLine: false,
    showDatasetMaximumValueLine: false,
    showDatasetAverageValueLine: true,
    showDatasetAngleAverageValueLine: false, // legacy (not currently rendered separately)
    showLabel: true,
    showTimeScale: false,
    startScaleAtZero: false,
    verticalChart: false,
    showYScale: false,
    yScaleSuggestedMin: null,
    yScaleSuggestedMax: null,
    enableMinMaxScaleLimit: false,
    yScaleMin: null,
    yScaleMax: null,
  };

  public lineChartData: ChartData<'line', { x: number, y: number }[]> = { datasets: [] };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: false,
    datasets: { line: { pointRadius: 0, pointHoverRadius: 0, tension: 0.4 } },
    animations: { tension: { easing: 'easeInOutCubic' } }
  };
  public lineChartType: ChartType = 'line';
  private chart: Chart;
  private dsServiceSub: Subscription | null = null;
  private datasetConfig: IDatasetServiceDatasetConfig | null = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo | null = null;
  private currentDatasetUUID: string | null = null;
  private lastVerticalChart: boolean | null = null;

  private pathSignature = computed<string | undefined>(() => {
    const cfg = this.runtime.options();
    if (!cfg.datachartPath) {
      return undefined;
    }
    return [cfg.datachartPath, cfg.convertUnitTo, cfg.datachartSource, cfg.timeScale, cfg.period].join('|');
  });
  private previousPathSignature: string | undefined = undefined;

  constructor() {
    // Effect: react to Dataset config changes
    effect(() => {
      const sig = this.pathSignature();
      if (sig !== this.previousPathSignature) {
        untracked(() => {
        this.previousPathSignature = sig;
        this.rebuildForDataset(this.runtime.options());
        });
      }
    });

    // Effect: react to Display config or theme changes
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        const verticalChanged = this.lastVerticalChart !== null && this.lastVerticalChart !== cfg.verticalChart;
        if (this.pathSignature() || verticalChanged) {
          this.lastVerticalChart = cfg.verticalChart;
          this.rebuildForDataset(cfg);
        } else if (this.chart) {
          // Styling / axis / annotation toggles / showAverageData
          this.ensureAverageDatasetPresence();
          this.updateAnnotationVisibility();
          this.applyDynamicTrackAverageStyling();
          this.setChartOptions(cfg);
          this.setDatasetsColors();
          this.ngZone.runOutsideAngular(() => this.chart?.update('none'));
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.rebuildForDataset(this.runtime.options());
  }

  private rebuildForDataset(cfg: IWidgetSvcConfig): void {
    if (!cfg.datachartPath) return; // Widget not yet configured
    this.dsServiceSub?.unsubscribe(); // Cleanup old subscription & chart data
    this.lineChartData.datasets = [];

    const dsConfig = this.dsService.list().find(ds => ds.uuid === this.id());
    if (dsConfig?.label !== this.pathSignature()) {
      this.dsService.remove(this.id());
      this.dsService.create(cfg.datachartPath, cfg.datachartSource, cfg.timeScale as TimeScaleFormat,cfg.period, this.pathSignature(), true, false, this.id());
    }

    if (!this.widgetDataChart()) return; // View not ready yet

    this.datasetConfig = this.dsService.getDatasetConfig(this.id());
    this.dataSourceInfo = this.dsService.getDataSourceInfo(this.id());
    if (!this.datasetConfig) return; // dataset not ready yet
    this.createDatasets(cfg);
    this.setChartOptions(cfg);
    // Always recreate chart instance on rebuild to ensure orientation/scale axis changes apply
    this.chart?.destroy();
    this.chart = new Chart(this.widgetDataChart().nativeElement.getContext('2d'), {
      type: this.lineChartType,
      data: this.lineChartData,
      options: this.lineChartOptions
    });
    this.startStreaming();
    this.ngZone.runOutsideAngular(() => this.chart?.update());
  }

  private setChartOptions(cfg: IWidgetSvcConfig): void {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;
    this.lineChartOptions.indexAxis = cfg.verticalChart ? 'y' : 'x';

    if (cfg.verticalChart) {
      this.lineChartOptions.scales = {
        y: {
          type: "time",
          display: cfg.showTimeScale,
          position: cfg.verticalChart ? "right" : "left",
          suggestedMin: "",
          suggestedMax: "",
          title: {
            display: true,
            text: `Last ${this.datasetConfig.period} ${this.datasetConfig.timeScaleFormat}`,
            align: "center"
          },
          time: {
            unit: this.datasetConfig.timeScaleFormat as TimeUnit,
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
            display: true,
            color: this.theme().contrastDimmer
          }
        },
        x: {
          type: "linear",
          display: cfg.showYScale,
          position: cfg.verticalChart ? "top" : "bottom",
          suggestedMin: cfg.enableMinMaxScaleLimit ? null : cfg.yScaleSuggestedMin,
          suggestedMax: cfg.enableMinMaxScaleLimit ? null : cfg.yScaleSuggestedMax,
          min: cfg.enableMinMaxScaleLimit ? cfg.yScaleMin : null,
          max: cfg.enableMinMaxScaleLimit ? cfg.yScaleMax : null,
          beginAtZero: cfg.startScaleAtZero,
          reverse: cfg.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: cfg.numDecimal,
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true,
            }
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer,
          }
        }
      }
    } else {
      this.lineChartOptions.scales = {
        x: {
          type: "time",
          display: cfg.showTimeScale,
          title: {
            display: true,
            text: `Last ${this.datasetConfig.period} ${this.datasetConfig.timeScaleFormat}`,
            align: "center"
          },
          time: {
            unit: this.datasetConfig.timeScaleFormat as TimeUnit,
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
            display: true,
            color: this.theme().contrastDimmer
          }
        },
        y: {
          display: cfg.showYScale,
          position: "right",
          suggestedMin: cfg.enableMinMaxScaleLimit ? null : cfg.yScaleSuggestedMin,
          suggestedMax: cfg.enableMinMaxScaleLimit ? null : cfg.yScaleSuggestedMax,
          min: cfg.enableMinMaxScaleLimit ? cfg.yScaleMin : null,
          max: cfg.enableMinMaxScaleLimit ? cfg.yScaleMax : null,
          beginAtZero: cfg.startScaleAtZero,
          reverse: cfg.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: cfg.numDecimal,
            color: this.getThemeColors().averageChartLine,
            major: {
              enabled: true,
            }
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer,
          }
        }
      }
    }
    this.lineChartOptions.plugins = {
      title: {
        display: true,
        align: "end",
        padding: {
          top: 3,
          bottom: 0
        },
        text: "",
        font: {
          size: 32,

        },
        color: this.getThemeColors().chartValue
      },
      subtitle: {
        display: cfg.showLabel,
        align: "start",
        padding: {
          top: -35,
          bottom: 20
        },
        text: `  ${cfg.displayName}`,
        font: {
          size: 22,
        },
        color: this.getThemeColors().chartLabel
      },
      annotation: {
        annotations: {
          minimumLine: {
            type: 'line',
            scaleID: cfg.verticalChart ? 'x' : 'y',
            display: cfg.showDatasetMinimumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              yAdjust: 12,
              padding: 4,
              color: this.getThemeColors().averageChartLine,
              backgroundColor: 'rgba(63,63,63,0.0)'
            }
          },
          maximumLine: {
            type: 'line',
            scaleID: cfg.verticalChart ? 'x' : 'y',
            display: cfg.showDatasetMaximumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              yAdjust: -12,
              padding: 4,
              color: this.getThemeColors().averageChartLine,
              backgroundColor: 'rgba(63,63,63,0.0)'
            }
          },
          averageLine: {
            type: 'line',
            scaleID: cfg.verticalChart ? 'x' : 'y',
            display: cfg.showDatasetAverageValueLine,
            value: null,
            borderDash: [6, 6],
            borderColor: this.getThemeColors().averageChartLine,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              padding: 4,
              color: this.getThemeColors().chartValue,
              backgroundColor: 'rgba(63,63,63,0.7)'
            }
          }
        }
      },
      legend: {
        display: false
      }
    }
  }

  private createDatasets(cfg: IWidgetSvcConfig): void {
    let valueFillDirection: string | boolean;
    let averageFillDirection: string | boolean;
    if (cfg.inverseYAxis && cfg.trackAgainstAverage) {
      valueFillDirection = "start";
      averageFillDirection = false;
    } else if (cfg.inverseYAxis && !cfg.trackAgainstAverage) {
      valueFillDirection = false;
      averageFillDirection = "start";
    } else if (!cfg.inverseYAxis && cfg.trackAgainstAverage) {
      valueFillDirection = true;
      averageFillDirection = false;
    } else {
      valueFillDirection = false;
      averageFillDirection = true;
    }

    this.lineChartData.datasets = [];
    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        order: cfg.trackAgainstAverage ? 1 : 0,
        parsing: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: cfg.trackAgainstAverage ? 0 : 3,
        fill: valueFillDirection,
      }
    );

    if (cfg.showAverageData) {
      this.lineChartData.datasets.push(
        {
          label: 'Average',
          data: [],
          order: cfg.trackAgainstAverage ? 0 : 1,
          parsing: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHitRadius: 0,
          borderWidth: cfg.trackAgainstAverage ? 3 : 0,
          fill: averageFillDirection,
        }
      );
    }
    this.setDatasetsColors();
  }

  private setDatasetsColors(): void {
    this.lineChartData.datasets.forEach((dataset) => {
      if (dataset.label === 'Value') {
        dataset.borderColor = this.getThemeColors().valueLine;
        dataset.backgroundColor = this.getThemeColors().valueFill;
      } else if (dataset.label === 'Average') {
        dataset.borderColor = this.getThemeColors().averageLine;
        dataset.backgroundColor = this.getThemeColors().averageFill;
      }
    });
  }

  // Ensure average dataset added or removed when showAverageData toggles without full rebuild
  private ensureAverageDatasetPresence(): void {
    const cfg = this.runtime.options();
    if (!cfg || !this.chart) return;
    const hasAverage = this.lineChartData.datasets.some(d => d.label === 'Average');
    if (cfg.showAverageData && !hasAverage) {
      // Insert average dataset maintaining order semantics
      const valueIdx = this.lineChartData.datasets.findIndex(d => d.label === 'Value');
      if (valueIdx >= 0) {
        const fillDir = cfg.inverseYAxis
          ? (cfg.trackAgainstAverage ? false : 'start')
          : (cfg.trackAgainstAverage ? false : true);
        this.lineChartData.datasets.push({
          label: 'Average', data: [], order: cfg.trackAgainstAverage ? 0 : 1, parsing: false, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 0, pointHitRadius: 0, borderWidth: cfg.trackAgainstAverage ? 3 : 0, fill: fillDir
        });
      }
    } else if (!cfg.showAverageData && hasAverage) {
      this.lineChartData.datasets = this.lineChartData.datasets.filter(d => d.label !== 'Average');
    }
  }

  // Recompute mutable dataset styling that depends on trackAgainstAverage + inverseYAxis without full rebuild
  private applyDynamicTrackAverageStyling(): void {
    const cfg = this.runtime.options();
    if (!cfg) return;
    const valueDs = this.lineChartData.datasets.find(d => d.label === 'Value');
    const avgDs = this.lineChartData.datasets.find(d => d.label === 'Average');
    // Fill directions replicate legacy matrix
    let valueFill: string | boolean;
    let averageFill: string | boolean;
    if (cfg.inverseYAxis && cfg.trackAgainstAverage) {
      valueFill = 'start';
      averageFill = false;
    } else if (cfg.inverseYAxis && !cfg.trackAgainstAverage) {
      valueFill = false;
      averageFill = 'start';
    } else if (!cfg.inverseYAxis && cfg.trackAgainstAverage) {
      valueFill = true; // fill downwards from average line
      averageFill = false;
    } else {
      valueFill = false;
      averageFill = true;
    }
    if (valueDs) {
      valueDs.order = cfg.trackAgainstAverage ? 1 : 0;
      valueDs.borderWidth = cfg.trackAgainstAverage ? 0 : 3;
      valueDs.fill = valueFill;
    }
    if (avgDs) {
      avgDs.order = cfg.trackAgainstAverage ? 0 : 1;
      avgDs.borderWidth = cfg.trackAgainstAverage ? 3 : 0;
      avgDs.fill = averageFill;
    }
  }

  private updateAnnotationVisibility(): void {
    const cfg = this.runtime.options();
    if (!cfg || !this.chart) return;
    const annCfg = (this.chart.options.plugins as unknown as { annotation?: { annotations?: Record<string, { display?: boolean }> } }).annotation?.annotations;
    if (!annCfg) return;
    if (annCfg.minimumLine) annCfg.minimumLine.display = cfg.showDatasetMinimumValueLine;
    if (annCfg.maximumLine) annCfg.maximumLine.display = cfg.showDatasetMaximumValueLine;
    if (annCfg.averageLine) annCfg.averageLine.display = cfg.showDatasetAverageValueLine;
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.runtime.options()?.color;
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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
        if (this.runtime.options()?.trackAgainstAverage) {
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

  private getUnitsLabel(): string {
    let label: string = null;
    const unit = this.runtime.options()?.convertUnitTo;
    switch (unit) {

      case "percent":
      case "percentraw":
        label = "%";
        break;

      case "latitudeMin":
        label = "latitude in minutes";
        break;

      case "latitudeSec":
        label = "latitude in secondes";
        break;

      case "longitudeMin":
        label = "longitude in minutes";
        break;

      case "longitudeSec":
        label = "longitude in secondes";
        break;

      default:
        label = unit;
        break;
    }

    return label;
  }

  private startStreaming(): void {
    const cfg = this.runtime.options();
    if (!cfg?.datachartPath) return;
    this.dsServiceSub?.unsubscribe();
    const batchThenLive$ = this.dsService.getDatasetBatchThenLiveObservable(this.id());
    this.dsServiceSub = batchThenLive$?.subscribe(dsPointOrBatch => {
      if (!this.chart) return;
      if (Array.isArray(dsPointOrBatch)) {
        const valueRows = this.transformDatasetRows(dsPointOrBatch, 0);
        this.chart.data.datasets[0].data.push(...valueRows);
        if (cfg.showAverageData && this.lineChartData.datasets[1]) {
          const avgRows = this.transformDatasetRows(dsPointOrBatch, cfg.datasetAverageArray);
          this.chart.data.datasets[1].data.push(...avgRows);
        }
      } else {
        const valueRow = this.transformDatasetRows([dsPointOrBatch], 0)[0];
        this.chart.data.datasets[0].data.push(valueRow);
        if (this.chart.data.datasets[0].data.length > (this.dataSourceInfo?.maxDataPoints ?? 0)) {
          this.chart.data.datasets[0].data.shift();
        }
        if (cfg.showAverageData && this.lineChartData.datasets[1]) {
          const avgRow = this.transformDatasetRows([dsPointOrBatch], cfg.datasetAverageArray)[0];
          this.chart.data.datasets[1].data.push(avgRow);
          if (this.chart.data.datasets[1].data.length > (this.dataSourceInfo?.maxDataPoints ?? 0)) {
            this.chart.data.datasets[1].data.shift();
          }
        }
        const trackValue: number = cfg.trackAgainstAverage ? (dsPointOrBatch.data.sma ?? dsPointOrBatch.data.value) : dsPointOrBatch.data.value;
        const convertedTrack = this.unitsService.convertToUnit(cfg.convertUnitTo, trackValue);
        this.chart.options.plugins.title.text = `${convertedTrack.toFixed(cfg.numDecimal)} ${this.getUnitsLabel()}`;
        const lastAverage = this.unitsService.convertToUnit(cfg.convertUnitTo, dsPointOrBatch.data.lastAverage);
        const lastMinimum = this.unitsService.convertToUnit(cfg.convertUnitTo, dsPointOrBatch.data.lastMinimum);
        const lastMaximum = this.unitsService.convertToUnit(cfg.convertUnitTo, dsPointOrBatch.data.lastMaximum);
  interface AnnPlugin { annotation?: { annotations?: Record<string, { value?: number; label?: { content?: string } }> } }
  const plugins = this.chart.options.plugins as unknown as AnnPlugin;
  const ann = plugins.annotation?.annotations;
        if (ann) {
          if (ann.averageLine?.value !== lastAverage) {
            ann.averageLine.value = lastAverage;
            ann.averageLine.label.content = `${lastAverage.toFixed(cfg.numDecimal)}`;
          }
          if (ann.minimumLine?.value !== lastMinimum) {
            ann.minimumLine.value = lastMinimum;
            ann.minimumLine.label.content = `${lastMinimum.toFixed(cfg.numDecimal)}`;
          }
            if (ann.maximumLine?.value !== lastMaximum) {
            ann.maximumLine.value = lastMaximum;
            ann.maximumLine.label.content = `${lastMaximum.toFixed(cfg.numDecimal)}`;
          }
        }
      }
      this.ngZone.runOutsideAngular(() => this.chart?.update('none'));
    });
  }

  private transformDatasetRows(rows: IDatasetServiceDatapoint[], datasetType): IDataSetRow[] {
    const cfg = this.runtime.options();
    const convert = (v: number) => this.unitsService.convertToUnit(cfg.convertUnitTo, v);
    const verticalChart = cfg.verticalChart;
    const avgKey = cfg.datasetAverageArray;

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
          return { x: convert(avgMap[avgKey]), y: row.timestamp };
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
          return { x: row.timestamp, y: convert(avgMap[avgKey]) };
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
    this.chart?.destroy();
    const canvas = this.widgetDataChart?.()?.nativeElement as HTMLCanvasElement | undefined;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
  }
}
