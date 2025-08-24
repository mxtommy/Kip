import { IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, viewChild, inject, effect, NgZone } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/data-set.service';
import { StreamChartBridgeService, StreamInfo } from '../../core/services/stream-chart-bridge.service';
import { Subscription } from 'rxjs';
import { CanvasService } from '../../core/services/canvas.service';

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
interface IDataSetRow {
  x: number,
  y: number
}

@Component({
  selector: 'widget-data-chart',
  imports: [WidgetHostComponent],
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly dsService = inject(DatasetService);
  private readonly streamBridge = inject(StreamChartBridgeService);
  private readonly ngZone = inject(NgZone);
  private readonly canvasService = inject(CanvasService);
  readonly widgetDataChart = viewChild('widgetDataChart', { read: ElementRef });
  public lineChartData: ChartData<'line', { x: number, y: number }[]> = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration['options'] = {
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
  public lineChartType: ChartType = 'line';
  private chart;
  private dsServiceSub: Subscription = null;
  private streamSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo = null;
  public availableStreams: StreamInfo[] = [];

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Chart Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      datasetUUID: null,
      inverseYAxis: false,
      datasetAverageArray: 'sma',
      showAverageData: true,
      trackAgainstAverage: false,
      showDatasetMinimumValueLine: false,
      showDatasetMaximumValueLine: false,
      showDatasetAverageValueLine: true,
      showDatasetAngleAverageValueLine: false,
      showLabel: false,
      showTimeScale: false,
      startScaleAtZero: false,
      verticalChart: false,
      showYScale: false,
      yScaleSuggestedMin: null,
      yScaleSuggestedMax: null,
      enableMinMaxScaleLimit: false,
      yScaleMin: null,
      yScaleMax: null,
      numDecimal: 1,
      color: 'contrast',
      // New stream-related config options
      dataSource: 'dataset', // 'dataset' or 'stream'
      selectedStreamId: null,
      streamAutoStart: true,
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
    this.loadAvailableStreams();
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  protected startWidget(): void {
    if (this.widgetProperties.config.dataSource === 'stream' && this.widgetProperties.config.selectedStreamId) {
      this.setupStreamData();
    } else {
      // Original dataset logic
      this.datasetConfig = this.dsService.getDatasetConfig(this.widgetProperties.config.datasetUUID);
      this.dataSourceInfo = this.dsService.getDataSourceInfo(this.widgetProperties.config.datasetUUID);

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
          this.chart.update();
        }

        this.startStreaming();
      }
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = this.widgetProperties.config.verticalChart ? 'y' : 'x';

    if (this.widgetProperties.config.verticalChart) {
      this.lineChartOptions.scales = {
        y: {
          type: "time",
          display: this.widgetProperties.config.showTimeScale,
          position: this.widgetProperties.config.verticalChart ? "right" : "left",
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
          display: this.widgetProperties.config.showYScale,
          position: this.widgetProperties.config.verticalChart ? "top" : "bottom",
          suggestedMin: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMin,
          suggestedMax: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMax,
          min: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMin : null,
          max: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMax : null,
          beginAtZero: this.widgetProperties.config.startScaleAtZero,
          reverse: this.widgetProperties.config.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.widgetProperties.config.numDecimal,
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
          display: this.widgetProperties.config.showTimeScale,
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
          display: this.widgetProperties.config.showYScale,
          position: "right",
          suggestedMin: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMin,
          suggestedMax: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMax,
          min: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMin : null,
          max: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMax : null,
          beginAtZero: this.widgetProperties.config.startScaleAtZero,
          reverse: this.widgetProperties.config.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.widgetProperties.config.numDecimal,
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
        display: this.widgetProperties.config.showLabel,
        align: "start",
        padding: {
          top: -35,
          bottom: 20
        },
        text: `  ${this.widgetProperties.config.displayName}`,
        font: {
          size: 22,
        },
        color: this.getThemeColors().chartLabel
      },
      annotation: {
        annotations: {
          minimumLine: {
            type: 'line',
            scaleID: this.widgetProperties.config.verticalChart ? 'x' : 'y',
            display: this.widgetProperties.config.showDatasetMinimumValueLine,
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
            scaleID: this.widgetProperties.config.verticalChart ? 'x' : 'y',
            display: this.widgetProperties.config.showDatasetMaximumValueLine,
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
            scaleID: this.widgetProperties.config.verticalChart ? 'x' : 'y',
            display: this.widgetProperties.config.showDatasetAverageValueLine,
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

  private createDatasets() {
    let valueFillDirection: string | boolean;
    let averageFillDirection: string | boolean;

    if (this.widgetProperties.config.inverseYAxis && this.widgetProperties.config.trackAgainstAverage) {
      valueFillDirection = "start";
      averageFillDirection = false;
    } else if (this.widgetProperties.config.inverseYAxis && !this.widgetProperties.config.trackAgainstAverage) {
      valueFillDirection = false;
      averageFillDirection = "start";
    } else if (!this.widgetProperties.config.inverseYAxis && this.widgetProperties.config.trackAgainstAverage) {
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
        order: this.widgetProperties.config.trackAgainstAverage ? 1 : 0,
        parsing: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: this.widgetProperties.config.trackAgainstAverage ? 0 : 3,
        fill: valueFillDirection,
      }
    );

    this.lineChartData.datasets.push(
      {
        label: 'Average',
        data: [],
        order: this.widgetProperties.config.trackAgainstAverage ? 0 : 1,
        parsing: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: this.widgetProperties.config.trackAgainstAverage ? 3 : 0,
        fill: averageFillDirection,
      }
    );

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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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
        if (this.widgetProperties.config.trackAgainstAverage) {
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

    switch (this.widgetProperties.config.convertUnitTo) {

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
        label = this.widgetProperties.config.convertUnitTo;
        break;
    }

    return label;
  }

  private startStreaming(): void {
    this.dsServiceSub?.unsubscribe();

    const batchThenLive$ = this.dsService.getDatasetBatchThenLiveObservable(
      this.widgetProperties.config.datasetUUID
    );

    this.dsServiceSub = batchThenLive$?.subscribe(dsPointOrBatch => {
      if (Array.isArray(dsPointOrBatch)) {
        // Initial batch: fill the chart with the last N points
        const valueRows = this.transformDatasetRows(dsPointOrBatch, 0);
        this.chart.data.datasets[0].data.push(...valueRows);
        if (this.widgetProperties.config.showAverageData) {
          const avgRows = this.transformDatasetRows(dsPointOrBatch, this.widgetProperties.config.datasetAverageArray);
          this.chart.data.datasets[1].data.push(...avgRows);
        }
      } else {
        // Live: handle new single datapoint
        const valueRow = this.transformDatasetRows([dsPointOrBatch], 0)[0];
        this.chart.data.datasets[0].data.push(valueRow);
        if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          this.chart.data.datasets[0].data.shift();
        }

        if (this.widgetProperties.config.showAverageData) {
          const avgRow = this.transformDatasetRows([dsPointOrBatch], this.widgetProperties.config.datasetAverageArray)[0];
          this.chart.data.datasets[1].data.push(avgRow);
          if (this.chart.data.datasets[1].data.length > this.dataSourceInfo.maxDataPoints) {
            this.chart.data.datasets[1].data.shift();
          }
        }

        // ... (rest of your live update logic for title, annotation, etc.)
        const trackValue: number = this.widgetProperties.config.trackAgainstAverage ? dsPointOrBatch.data.sma : dsPointOrBatch.data.value;
        this.chart.options.plugins.title.text = `${this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, trackValue).toFixed(this.widgetProperties.config.numDecimal)} ${this.getUnitsLabel()} `;

        const lastAverage = this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, dsPointOrBatch.data.lastAverage);
        const lastMinimum = this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, dsPointOrBatch.data.lastMinimum);
        const lastMaximum = this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, dsPointOrBatch.data.lastMaximum);

        if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
          this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
          this.chart.options.plugins.annotation.annotations.averageLine.label.content = `${lastAverage.toFixed(this.widgetProperties.config.numDecimal)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.minimumLine.value != lastMinimum) {
          this.chart.options.plugins.annotation.annotations.minimumLine.value = lastMinimum;
          this.chart.options.plugins.annotation.annotations.minimumLine.label.content = `${lastMinimum.toFixed(this.widgetProperties.config.numDecimal)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.maximumLine.value != lastMaximum) {
          this.chart.options.plugins.annotation.annotations.maximumLine.value = lastMaximum;
          this.chart.options.plugins.annotation.annotations.maximumLine.label.content = `${lastMaximum.toFixed(this.widgetProperties.config.numDecimal)}`;
        }
      }

      this.ngZone.runOutsideAngular(() => {
        this.chart?.update('quiet');
      });
    });
  }

  private transformDatasetRows(rows: IDatasetServiceDatapoint[], datasetType): IDataSetRow[] {
    const convert = (v: number) =>
      this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, v);
    const verticalChart = this.widgetProperties.config.verticalChart;
    const avgKey = this.widgetProperties.config.datasetAverageArray;

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

  private loadAvailableStreams(): void {
    this.streamBridge.getAvailableStreams().subscribe(streams => {
      this.availableStreams = streams;
    });
  }

  private setupStreamData(): void {
    const streamId = this.widgetProperties.config.selectedStreamId;
    
    // Ingest existing stream first
    this.streamBridge.ingestExistingStream(streamId).subscribe(result => {
      if (result.success) {
        // Create simplified chart setup for stream data
        this.createStreamChart();
        
        if (this.widgetProperties.config.streamAutoStart) {
          this.startStreamForChart(streamId);
        }
        
        // Subscribe to stream updates
        this.streamSub = this.streamBridge.getStreamUpdates(streamId).subscribe(dataset => {
          if (dataset) {
            this.updateChartWithStreamData(dataset);
          }
        });
      }
    });
  }

  private createStreamChart(): void {
    // Create simplified datasets for stream data (no averaging for now)
    this.lineChartData.datasets = [{
      label: 'Stream Data',
      data: [],
      parsing: false,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 0,
      borderWidth: 2,
      fill: false,
      borderColor: this.getThemeColors().valueLine,
      backgroundColor: this.getThemeColors().valueFill,
    }];

    // Set stream-appropriate chart options
    this.setStreamChartOptions();

    if (!this.chart) {
      this.chart = new Chart(this.widgetDataChart().nativeElement.getContext('2d'), {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions
      });
    } else {
      this.chart.update();
    }
  }

  private setStreamChartOptions(): void {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    // Simplified options for stream data
    this.lineChartOptions.scales = {
      x: {
        type: "time",
        display: this.widgetProperties.config.showTimeScale,
        title: {
          display: true,
          text: "Time",
          align: "center"
        },
        ticks: {
          color: this.getThemeColors().averageChartLine,
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer
        }
      },
      y: {
        display: this.widgetProperties.config.showYScale,
        position: "right",
        beginAtZero: this.widgetProperties.config.startScaleAtZero,
        reverse: this.widgetProperties.config.inverseYAxis,
        ticks: {
          maxTicksLimit: 8,
          precision: this.widgetProperties.config.numDecimal,
          color: this.getThemeColors().averageChartLine,
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer,
        }
      }
    };

    this.lineChartOptions.plugins = {
      title: {
        display: true,
        align: "end",
        text: "",
        font: { size: 32 },
        color: this.getThemeColors().chartValue
      },
      subtitle: {
        display: this.widgetProperties.config.showLabel,
        align: "start",
        padding: { top: -35, bottom: 20 },
        text: `  ${this.widgetProperties.config.displayName}`,
        font: { size: 22 },
        color: this.getThemeColors().chartLabel
      },
      legend: { display: false }
    };
  }

  private startStreamForChart(streamId: string): void {
    this.streamBridge.startStreamForChart(streamId).subscribe(result => {
      if (!result.success) {
        console.error('Failed to start stream:', result.error);
      }
    });
  }

  private updateChartWithStreamData(dataset: any): void {
    if (!dataset.data || dataset.data.length === 0) {
      return;
    }

    // Convert stream dataset to chart format
    const chartData = dataset.data.map((point: any) => ({
      x: new Date(point[0]).getTime(),
      y: point[1]
    }));

    // Update chart data
    this.chart.data.datasets[0].data = chartData;

    // Update title with latest value
    const latestValue = chartData[chartData.length - 1]?.y;
    if (latestValue !== undefined) {
      this.chart.options.plugins.title.text = `${latestValue.toFixed(this.widgetProperties.config.numDecimal)}`;
    }

    this.ngZone.runOutsideAngular(() => {
      this.chart?.update('none');
    });
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.dsServiceSub?.unsubscribe();
    this.streamSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
    this.chart?.destroy();
    const canvas = this.widgetDataChart?.()?.nativeElement as HTMLCanvasElement | undefined;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
  }
}
