import { Component, ViewChild, OnInit, OnDestroy, ElementRef } from '@angular/core';import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { DatasetService, IDatasetServiceDatasetConfig, IDatasetServiceDatapoint } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';
import { differenceInSeconds } from "date-fns";

import { Chart, ChartConfiguration, ChartData, ChartType, TimeUnit } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';
import ChartStreaming from '@robloche/chartjs-plugin-streaming';


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
  @ViewChild('widgetDataChart', {static: true, read: ElementRef}) widgetDataChart: ElementRef;

  private transformDatasetRow = (row: IDatasetServiceDatapoint, datasetType) => {
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
      trackAgainstAverage: false,
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

    Chart.register(annotationPlugin, ChartStreaming);
   }

  ngOnInit(): void {
    this.datasetConfig = this.dsService.get(this.widgetProperties.config.datasetUUID);
    this.validateConfig();


    if (this.datasetConfig) {
      this.setChartOptions();

      this.chart = new Chart(this.widgetDataChart.nativeElement.getContext('2d'), {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions
      });

      this.startStreaming();
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

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
        borderColor: this.getThemeColors().valueLine,
        borderWidth: this.widgetProperties.config.trackAgainstAverage ? 0 : 3,
        fill: this.widgetProperties.config.trackAgainstAverage ? true : false,
        backgroundColor: this.getThemeColors().valueFill,
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
        borderColor: this.getThemeColors().averageLine,
        borderWidth: this.widgetProperties.config.trackAgainstAverage ? 3 : 0,
        fill: this.widgetProperties.config.trackAgainstAverage ? false : true,
        backgroundColor: this.getThemeColors().averageFill,
      }
    );

    this.lineChartOptions.scales = {
      x: {
        type: "realtime",
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
            hour: `k:mm\''`,
            minute: `mm\''`,
            second: `ss"`,
            millisecond: "SSS"
          }
        },
        ticks: {
          autoSkip: false,
          // callback(tickValue, index, ticks) {
            // return differenceInSeconds(new Date.now(), tickValue as number);
          // },
          // maxTicksLimit: 8,
          major: {
            enabled: true
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
       streaming: {
        duration: this.datasetConfig.maxDataPoints * this.datasetConfig.sampleTime,
        delay: this.datasetConfig.sampleTime,
        frameRate: this.datasetConfig.timeScaleFormat  === "hour" ? 8 : this.datasetConfig.timeScaleFormat  === "minute" ? 15 : 30,
       }
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
        if (this.widgetProperties.config.trackAgainstAverage) {
          colors.valueLine = this.theme.textDark;
          colors.valueFill = this.theme.textDark.replace(/[\d\.]+\)$/g, '0.15)');
          colors.averageLine = this.theme.text;
          colors.averageFill = this.theme.text;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme.text;
          colors.valueFill = this.theme.text;
          colors.averageLine = this.theme.textDark;
          colors.averageFill = this.theme.textDark.replace(/[\d\.]+\)$/g, '0.15)');
          colors.chartValue = this.theme.text;
        }
        colors.averageChartLine = this.theme.textDark;
        colors.chartLabel = this.theme.textDark;

        break;

      case "primary":
        if (this.widgetProperties.config.trackAgainstAverage) {
          colors.valueLine = this.theme.textPrimaryDark;
          colors.valueFill = this.theme.textPrimaryDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.averageLine = this.theme.textPrimaryLight;
          colors.averageFill = this.theme.textPrimaryLight;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme.textPrimaryLight;
          colors.valueFill = this.theme.textPrimaryLight;
          colors.averageLine = this.theme.textPrimaryDark;
          colors.averageFill = this.theme.textPrimaryDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme.textDark;
        colors.chartLabel = this.theme.textDark;
        break;

      case "accent":
        if (this.widgetProperties.config.trackAgainstAverage) {
          colors.valueLine = this.theme.textAccentDark;
          colors.valueFill = this.theme.textAccentDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.averageLine = this.theme.textAccentLight;
          colors.averageFill = this.theme.textAccentLight;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme.textAccentLight;
          colors.valueFill = this.theme.textAccentLight;
          colors.averageLine = this.theme.textAccentDark;
          colors.averageFill = this.theme.textAccentDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme.textDark;
        colors.chartLabel = this.theme.textDark;
        break;

      case "warn":
        if (this.widgetProperties.config.trackAgainstAverage) {
          colors.valueLine = this.theme.textWarnDark;
          colors.valueFill = this.theme.textWarnDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.averageLine = this.theme.textWarnLight;
          colors.averageFill = this.theme.textWarnLight;
          colors.chartValue = colors.averageLine;
        } else {
          colors.valueLine = this.theme.textWarnLight;
          colors.valueFill = this.theme.textWarnLight;
          colors.averageLine = this.theme.textWarnDark;
          colors.averageFill = this.theme.textWarnDark.replace(/[\d\.]+\)$/g, '0.25)');
          colors.chartValue = colors.valueFill;
        }
        colors.averageChartLine = this.theme.textDark;
        colors.chartLabel = this.theme.textDark;

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
      (dsPoint: IDatasetServiceDatapoint) => {

        this.chart.data.datasets[0].data.push(this.transformDatasetRow(dsPoint, 0));
        // Average dataset
        if (this.widgetProperties.config.showAverageData) {
          this.chart.data.datasets[1].data.push(this.transformDatasetRow(dsPoint, this.widgetProperties.config.datasetAverageArray));
        }

        let trackValue: number = this.widgetProperties.config.trackAgainstAverage ? dsPoint.data.sma : dsPoint.data.value;
        this.chart.options.plugins.title.text =  `${this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, trackValue).toFixed(this.widgetProperties.config.numDecimal)} ${this.getUnitsLabel()} `;

        const lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastAverage);
        const lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMinimum);
        const lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMaximum);

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

        this.chart?.update('quiet');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
      this.chart?.destroy();
  }
}
