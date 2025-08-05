import { IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
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
  private readonly dsService = inject(DatasetService);
  private readonly ngZone = inject(NgZone);
  readonly widgetDataChart = viewChild('widgetDataChart', { read: ElementRef });
  public lineChartData: ChartData <'line', {x: number, y: number} []> = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: false,
    datasets: {
      line: {
        pointRadius: 0, // disable for all `'line'` datasets
        pointHoverRadius: 0, // disable for all `'line'` datasets
        tension:  0.4,
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
  private datasetConfig: IDatasetServiceDatasetConfig = null;
  private dataSourceInfo: IDatasetServiceDataSourceInfo = null;

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      datasetUUID: null,
      datasetAverageArray: 'sma',
      numDecimal: 1,
      color: 'contrast',
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
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  protected startWidget(): void {
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

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
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
          text: `Last ${this.datasetConfig.period} ${this.datasetConfig.timeScaleFormat}`,
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
        min: 45,
        max: 90,
        title: {
          display: false
         },
        ticks: {
          callback: (value: number) => ((value + 360) % 360).toFixed(0), // wrap-around formatting
          count: 2,
          font: {
            size: 20,
          },
        },
        grid: {
          display: true,
          color: this.theme().contrastDimmer
         }
      }
    };

    this.lineChartOptions.plugins = {
      subtitle: {
        display: true,
        align: "start",
        padding: {
          top: -70,
          bottom: 35
        },
        text: `  TWD`,
        font: {
          size: 28
        },
        color: this.getThemeColors().chartLabel
      },
      title: {
        display: true,
        align: "center",
        padding: {
          top: 0,
          bottom: 0
        },
        text: "",
        font: {
          size: 62,

        },
        color: this.getThemeColors().chartValue
      },
      annotation : {
        annotations: {
          averageLine: {
            type: 'line',
            scaleID: 'x',
            display: true,
            value: null,
            borderColor: this.getThemeColors().averageChartLine,
            drawTime: 'afterDatasetsDraw',
            borderWidth: 4,
            label: {
              xAdjust: 0,
              yAdjust: -8,
              display: true,
              position: "start",
              padding: 8,
              font: {
                size: 22,
              },
              color: this.getThemeColors().chartValue,
              backgroundColor: 'rgba(63,63,63,1)'
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
    this.lineChartData.datasets = [];
    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        order: 2,
        parsing: false,
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
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 10,
        fill: false, // Will be set dynamically based on lastAverage
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
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        borderWidth: 0,
        borderColor: '',
        fill: false,
      }
    );

    this.setDatasetsColors();
  }

  private startStreaming(): void {
    this.dsServiceSub?.unsubscribe();

    const batchThenLive$ = this.dsService.getDatasetBatchThenLiveObservable(
      this.widgetProperties.config.datasetUUID
    );

    this.dsServiceSub = batchThenLive$?.subscribe(dsPointOrBatch => {
      if (Array.isArray(dsPointOrBatch)) {
        // Initial batch: fill the chart with the last N points
        const valueRows = this.transformDatasetRows(dsPointOrBatch, 'value');
        this.chart.data.datasets[0].data.push(...valueRows);

        const avgRows = this.transformDatasetRows(dsPointOrBatch, 'sma');
        this.chart.data.datasets[1].data.push(...avgRows);

        const lastAvgRows = this.transformDatasetRows(dsPointOrBatch, 'avg');
        this.chart.data.datasets[2].data.push(...lastAvgRows);

      } else {
        // Live: handle new single datapoint
        const valueRow = this.transformDatasetRows([dsPointOrBatch], 'value')[0];
        this.chart.data.datasets[0].data.push(valueRow);

        const avgRow = this.transformDatasetRows([dsPointOrBatch], 'sma')[0];
        this.chart.data.datasets[1].data.push(avgRow);

        const lastAvgRows = this.transformDatasetRows([dsPointOrBatch], 'avg')[0];
        this.chart.data.datasets[2].data.push(lastAvgRows);

        if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          this.chart.data.datasets[0].data.shift();
          this.chart.data.datasets[1].data.shift();
          this.chart.data.datasets[2].data.shift();
        }

        // Update Title value
        const trackValue: number = dsPointOrBatch.data.value;
        this.chart.options.plugins.title.text =  `${this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, trackValue).toFixed(0)}°`;

        // Update last average, min, max lines
        const last = this.chart.data.datasets[2].data.length -1;
        const lastAverage = this.chart.data.datasets[2].data[last].x;
        const lastMinimum = this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, dsPointOrBatch.data.lastMinimum);
        const lastMaximum = this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, dsPointOrBatch.data.lastMaximum);

        // Calculate dynamic scale range
        const minDiff = Math.abs(lastAverage - lastMinimum);
        const maxDiff = Math.abs(lastMaximum - lastAverage);
        const dynamicScaleRange = Math.max(minDiff, maxDiff) * 1.1;
        this.chart.options.scales.x.min = lastAverage - dynamicScaleRange;
        this.chart.options.scales.x.max = lastAverage + dynamicScaleRange;

        // Draw average line
        if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
          this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
          this.chart.options.plugins.annotation.annotations.averageLine.label.content = `${lastAverage.toFixed(0)}°`;
        }
      }

      this.ngZone.runOutsideAngular(() => {
        this.chart?.update('quiet');
      });
    });
  }

  private transformDatasetRows(rows: IDatasetServiceDatapoint[], datasetType: string): IDataSetRow[] {
    const convert = (v: number) => this.unitsService.convertToUnit(this.widgetProperties.config.convertUnitTo, v);

    return rows.map(row => {
      const rowMapping = {
        value: row.data.value,
        sma: row.data.sma,
        ema: row.data.ema,
        dema: row.data.doubleEma,
        avg: row.data.lastAverage
      };
      return { x: convert(rowMapping[datasetType]), y: row.timestamp };
    });
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
    this.dsServiceSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
    this.chart?.destroy();
  }
}
