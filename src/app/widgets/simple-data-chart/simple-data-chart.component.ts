import { Component, OnDestroy, ElementRef, viewChild, inject, effect, NgZone, input } from '@angular/core';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDataSourceInfo } from '../../core/services/data-set.service';
import { IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType, TimeUnit, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, CategoryScale} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ITheme } from '../../core/services/app-service';
import { UnitsService } from '../../core/services/units.service';

Chart.register(TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, CategoryScale);

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
  selector: 'simple-data-chart',
  standalone: true,
  imports: [],
  templateUrl: './simple-data-chart.component.html',
  styleUrls: ['./simple-data-chart.component.scss'],
})
export class SimpleDataChartComponent implements OnDestroy {
  protected readonly theme = input.required<ITheme>();
  public color: string = null;
  public dataPath: string = null;
  public dataSource: string = null;
  public convertUnitTo: string = null;
  public numDecimal: number = null;
  public yScaleMin: number = null;
  public yScaleMax: number = null;
  public inverseYAxis = false;
  public verticalChart = null;
  public datasetUUID: string = null;
  protected unitsService = inject(UnitsService);
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

   private config = {
    datasetAverageArray: 'sma',
    showAverageData: false,
    trackAgainstAverage: false,
    startScaleAtZero: false,
    yScaleSuggestedMin: null,
    yScaleSuggestedMax: null,
    enableMinMaxScaleLimit: false,
  };

  constructor() {
    effect(() => {
      if (this.theme()) {
        if (this.datasetConfig) {
          this.setChartOptions();
          this.setDatasetsColors();
        }
      }
    });
  }

  public startChart(): void {
    if (!this.datasetUUID) return;
    this.datasetConfig = this.dsService.getDatasetConfig(this.datasetUUID);
    this.dataSourceInfo = this.dsService.getDataSourceInfo(this.datasetUUID);

    if (this.datasetConfig) {
      this.setChartOptions();
      this.createDatasets();

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

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = this.verticalChart ? 'y' : 'x';

    if (this.verticalChart) {
      this.lineChartOptions.scales = {
        x: {
          display: false,
          position: "right",
          suggestedMin: this.config.enableMinMaxScaleLimit ? null : this.yScaleMin,
          suggestedMax: this.config.enableMinMaxScaleLimit ? null : this.yScaleMax,
          min: this.config.enableMinMaxScaleLimit ? this.yScaleMin : null,
          max: this.config.enableMinMaxScaleLimit ? this.yScaleMax : null,
          beginAtZero: this.config.startScaleAtZero,
          reverse: this.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.numDecimal,
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
          type: "time",
          display: false,
            title: {
            display: false
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
            display: false,
            color: this.theme().contrastDimmer
          }
        }
      };
    } else {
      this.lineChartOptions.scales = {
        x: {
          type: "time",
          display: false,
          title: {
          display: false
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
          display: false,
          color: this.theme().contrastDimmer
        }
        },
        y: {
          display: false,
          position: "right",
          suggestedMin: this.config.enableMinMaxScaleLimit ? null : this.yScaleMin,
          suggestedMax: this.config.enableMinMaxScaleLimit ? null : this.yScaleMax,
          min: this.config.enableMinMaxScaleLimit ? this.yScaleMin : null,
          max: this.config.enableMinMaxScaleLimit ? this.yScaleMax : null,
          beginAtZero: this.config.startScaleAtZero,
          reverse: this.inverseYAxis,
          title: {
            display: false,
            text: "Value Axis",
            align: "center"
          },
          ticks: {
            maxTicksLimit: 8,
            precision: this.numDecimal,
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
      }
    }
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
    this.dsServiceSub = this.dsService.getDatasetObservable(this.datasetUUID).subscribe(
      (dsPoint: IDatasetServiceDatapoint) => {

        // Add new data point to the first dataset
        this.chart.data.datasets[0].data.push(this.transformDatasetRow(dsPoint, 0));
        // Trim the first dataset if it exceeds maxDataPoints
        if (this.chart.data.datasets[0].data.length > this.dataSourceInfo.maxDataPoints) {
          this.chart.data.datasets[0].data.shift();
        }

        // Add new data point to the second dataset (average dataset)
        if (this.config.showAverageData) {
          this.chart.data.datasets[1].data.push(this.transformDatasetRow(dsPoint, this.config.datasetAverageArray));
          // Trim the second dataset if it exceeds maxDataPoints
          if (this.chart.data.datasets[1].data.length > this.dataSourceInfo.maxDataPoints) {
            this.chart.data.datasets[1].data.shift();
          }
        }

        this.ngZone.runOutsideAngular(() => {
          this.chart?.update('quiet');
        });
      }
    );
  }

  private transformDatasetRow(row: IDatasetServiceDatapoint, datasetType): IDataSetRow {
    const convert = (v: number) => this.unitsService.convertToUnit(this.convertUnitTo, v);

    if (this.verticalChart) {
      // Vertical chart: x = value, y = time
      if (datasetType === 0) {
        return { x: convert(row.data.value), y: row.timestamp };
      } else {
        const avgMap = {
          sma: row.data.sma,
          ema: row.data.ema,
          dema: row.data.doubleEma,
          avg: row.data.lastAverage
        };
        return { x: convert(avgMap[this.config.datasetAverageArray]), y: row.timestamp };
      }
    } else {
      // Standard chart: x = time, y = value
      if (datasetType === 0) {
        return { x: row.timestamp, y: convert(row.data.value) };
      } else {
        const avgMap = {
          sma: row.data.sma,
          ema: row.data.ema,
          dema: row.data.doubleEma,
          avg: row.data.lastAverage
        };
        return { x: row.timestamp, y: convert(avgMap[this.config.datasetAverageArray]) };
      }
    }
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
    // we need to destroy when moving Pages to remove Chart Objects
    this.chart?.destroy();
  }
}
