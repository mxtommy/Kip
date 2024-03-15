
import { Component, ViewChild, OnInit, OnDestroy, ElementRef } from '@angular/core';import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { DatasetService, IDatasetServiceDatasetConfig, IDatasetServiceDataset } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
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

@Component({
  selector: 'widget-data-chart',
  standalone: true,
  imports: [],
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('chartTrends', {static: true, read: ElementRef}) chartTrends: ElementRef;

  private transformDatasetRow = (row: IDatasetServiceDataset, datasetType) => {
    const newRow: {x: number, y: number} = {x: row.timestamp, y: null};

    // Check if its a value or an average row
    if (datasetType === 0) {
      newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
    } else {
      switch (this.widgetProperties.config.datasetAverageArray) {
        case "sma":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.sma);
          break;
        case "ema":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.ema);
          break;

        case "dema":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.doubleEma);
          break;

        case "avg":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastAverage);
          break;
      }
    }
    return newRow;
  };
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

  constructor(private dsService: DatasetService) {
    super();

    this.defaultConfig = {
      displayName: 'Chart Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      datasetUUID: null,
      invertData: false,
      datasetAverageArray: 'sma',
      showAverageData: true,
      showDatasetMinimumValueLine: false,
      showDatasetMaximumValueLine: false,
      showDatasetAverageValueLine: true,
      showDatasetAngleAverageValueLine: false,
      showLabel: false,
      showYScale: false,
      showTimeScale: false,
      startScaleAtZero: true,
      verticalGraph: false,
      enableMinMaxScaleLimit: false,
      minValue: null,
      maxValue: null,
      numDecimal: 1,
      textColor: 'primary',
    };

    Chart.register(annotationPlugin);
   }

  ngOnInit(): void {
    this.validateConfig();
    this.setChartOptions();

    // Get dataset configuration
    this.datasetConfig = this.dsService.get(this.widgetProperties.config.datasetUUID);

    if (this.datasetConfig) {
        this.chart = new Chart(this.chartTrends.nativeElement.getContext('2d'), {
          type: this.lineChartType,
          data: this.lineChartData,
          options: this.lineChartOptions
        });

      this.startStreaming();
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;

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
        borderWidth: 0,
        backgroundColor: this.getThemeColors().averageFill,
        fill: true
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
        borderColor: this.getThemeColors().valueLine,
        fill: false
      }
    );

    this.lineChartOptions.scales = {
      x: {
        type: "time",
        display: this.widgetProperties.config.showTimeScale,
        time: {
          unit: "second",
          minUnit: "second",
          round: "second",
          displayFormats: {
            second: "ss"
          }
        },
        grid: {
          display: true
        }
      },
      y: {
        display: this.widgetProperties.config.showYScale,
        position: "right",
        beginAtZero: !this.widgetProperties.config.startScaleAtZero,
        grace: "5%",
        title: {
          display: false,
          text: "Value Axis",
          align: "center"
        },
        ticks: {
          maxTicksLimit: 6
        },
        grid: {
          display: true
        }
      }
    }

    this.lineChartOptions.plugins = {
      subtitle: {
        display: this.widgetProperties.config.showLabel,
        align: "start",
        padding: {
          top: -31,
          bottom: 4
        },
        text: `  ${this.widgetProperties.config.displayName}`,
        font: {
          size: 14,
        },
        color: this.getThemeColors().chartLabel
      },
      title: {
        display: true,
        align: "end",
        padding: {
          top: 6,
          bottom: 10
        },
        text: "",
        font: {
          size: 22,

        },
        color: this.getThemeColors().chartValue
      },
      annotation : {
        annotations: {
          // labelValue: {
          //   type: 'label',
          //   textAlign: "start",
          //   position: {
          //     x: "end",
          //     y: "center"
          //   },
          //   yAdjust(ctx, options) {
          //     const {chart: {scales: {x, y}, data}} = ctx;

          //     // console.warn(datasets[1].data[0]);


          //     if (data.datasets[1].data.length < 1) {
          //       return 10;
          //     }
          //     let c =  data.datasets[1].data[data.datasets[1].data.length - 1];
          //     const yPosition = y.getPixelForValue(7);
          //     return yPosition;
          //   },
          //   // xAdjust(ctx, options) {
          //   //   const {chart: {chartArea: { top, bottom, left, right, height, width}}} = ctx;

          //   //   return -((width / 2) - (ctx.element.width/2) - left - 10);
          //   // },
          //   // yAdjust(ctx, options) {
          //   //   const {chart: {chartArea: { top, bottom, left, right, height, width}}} = ctx;
          //   //   return -((ctx.chart.height / 2) - (ctx.element.height/2) +10);
          //   // },
          //   backgroundColor: 'rgba(245,245,245)',
          //   content: ['My text', 'second line'],
          //   font: {
          //     size: 18
          //   }
          // },
          minimumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.startScaleAtZero ? false : this.widgetProperties.config.showDatasetMinimumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              yAdjust: 12,
              padding: 4,
              color: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(63,63,63,0.0)'
            }
          },
          maximumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.showDatasetMaximumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              yAdjust: -12,
              padding: 4,
              color:  'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(63,63,63,0.0)'
            }
          },
          averageLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.showDatasetAverageValueLine,
            value: null,
            borderDash: [6, 6],
            borderColor: this.getThemeColors().averageChartLine,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true,
              position: "start",
              padding: 4,
              color: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(63,63,63,0.7)'
            }
          }
        }
      },
      legend: {
        display: false
      },


    }
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.widgetProperties.config.textColor;
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
      case "text":
        colors.valueLine = this.theme.text;
        colors.valueFill = this.theme.text;
        colors.averageLine = this.theme.textDark;
        colors.averageFill = this.theme.textDark;
        colors.averageChartLine = this.theme.textDark;
        colors.chartLabel = this.theme.textDark;
        colors.chartValue = this.theme.text;
        break;

      case "primary":
        colors.valueLine = this.theme.textPrimaryLight;
        colors.valueFill = this.theme.textPrimaryLight;
        colors.averageLine = this.theme.textPrimaryDark;
        colors.averageFill = this.theme.textPrimaryDark;
        colors.averageChartLine = this.theme.primary;
        colors.chartLabel = this.theme.textDark;
        colors.chartValue = colors.valueFill;
        break;

      case "accent":
        colors.valueLine = this.theme.textAccentLight;
        colors.valueFill = this.theme.textAccentLight;
        colors.averageLine = this.theme.textAccentDark;
        colors.averageFill = this.theme.textAccentDark;
        colors.averageChartLine = this.theme.accent;
        colors.chartLabel = this.theme.textDark;
        colors.chartValue = colors.valueFill;
        break;

      case "warn":
        colors.valueLine = this.theme.textWarnLight;
        colors.valueFill = this.theme.textWarnLight;
        colors.averageLine = this.theme.textWarnDark;
        colors.averageFill = this.theme.textWarnDark;
        colors.averageChartLine = this.theme.warn;
        colors.chartLabel = this.theme.textDark;
        colors.chartValue = colors.valueFill;
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
    this.dsServiceSub = this.dsService.getDatasetObservable(this.widgetProperties.config.datasetUUID).subscribe(
      (dsPoint: IDatasetServiceDataset) => {
        if (!dsPoint) return; // we will get null back if we subscribe to a dataset before the app has started it. No need to update until we have values

        if (this.lineChartData.datasets[0].data.length >= this.datasetConfig.maxDataPoints) {
          this.lineChartData.datasets.forEach(dataset => dataset.data.shift());
        }

        // Value datasets
        this.lineChartData.datasets[0].data.push(this.transformDatasetRow(dsPoint, 0));
        // Average dataset
        if (this.widgetProperties.config.showAverageData) {
          this.lineChartData.datasets[1].data.push(this.transformDatasetRow(dsPoint, this.widgetProperties.config.datasetAverageArray));
        }

        this.chart.options.plugins.title.text =  `${this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.value).toFixed(this.widgetProperties.config.numDecimal)} ${this.getUnitsLabel()} `;

        const lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastAverage);
        const lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMinimum);
        const lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMaximum);

        if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
          this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
          this.chart.options.plugins.annotation.annotations.averageLine.label.content = `Avg: ${lastAverage.toFixed(this.widgetProperties.config.numDecimal)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.minimumLine.value != lastMinimum) {
          this.chart.options.plugins.annotation.annotations.minimumLine.value = lastMinimum;
          this.chart.options.plugins.annotation.annotations.minimumLine.label.content = `Min: ${lastMinimum.toFixed(this.widgetProperties.config.numDecimal)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.maximumLine.value != lastMaximum) {
          this.chart.options.plugins.annotation.annotations.maximumLine.value = lastMaximum;
          this.chart.options.plugins.annotation.annotations.maximumLine.label.content = `Max: ${lastMaximum.toFixed(this.widgetProperties.config.numDecimal)}`;
        }

        this.chart?.update('none');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
  }
}
