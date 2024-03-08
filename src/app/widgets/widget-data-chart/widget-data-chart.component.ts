import { Component, ViewChild, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { DatasetService, IDatasetServiceDatasetConfig, IDatasetServiceDataset } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

// import { BaseChartDirective } from 'ng2-charts';
// import Chart from 'chart.js/auto'
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';


@Component({
  selector: 'widget-data-chart',
  standalone: true,
  imports: [],
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  // @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('chartTrends', {static: true, read: ElementRef}) chartTrends: ElementRef;

  private transformDataset = (rawDs: IDatasetServiceDataset[], datasetIndex: number) => {
    let newDs = [];
    rawDs.map(row => {
      newDs.push(this.transformDatasetRow(row, datasetIndex));
    });
    return newDs;
  };
  private transformDatasetRow = (row: IDatasetServiceDataset, datasetType: number) => {
    const newRow: {timestamp: number, value?: number, ema?: number, doubleEma?: number, lastAngleAverage?: number, lastAverage?: number, lastMinimum?: number, lastMaximum?: number} = {
      timestamp: row.timestamp
    };

    switch (datasetType) {
      case 0:
        newRow.value = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
        break;

      case 1:
        newRow.ema = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.ema);
        break;

      case 2:
        newRow.doubleEma = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.doubleEma);
        break;

      case 3:
        newRow.lastAngleAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastAngleAverage);
        break;

      case 4:
        newRow.lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastAverage);
        break;

      case 5:
        newRow.lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastMinimum);
        break;

      case 6:
        newRow.lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastMaximum);
        break;

      default: newRow.value = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
        break;
    }
    return newRow;
  };

  public lineChartData: ChartData <'line', {timestamp: number, value?: number,ema?: number, doubleEma?: number, lastAngleAverage?: number, lastAverage?: number, lastMinimum?: number, lastMaximum?: number } []> = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: {
      xAxisKey: 'timestamp',
    },
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
      displayEMADataset: true,
      displayDEMADataset: true,
      displayDatasetMinimumValueLine: false,
      displayDatasetMaximumValueLine: false,
      displayDatasetAverageValueLine: false,
      displayDatasetAngleAverageValueLine: false,
      startScaleAtZero: false,
      enableMinMaxScaleLimit: false,
      minValue: null,
      maxValue: null,
      verticalGraph: false,
    };

    Chart.register(annotationPlugin);
   }

  ngOnInit(): void {
    this.validateConfig();
    this.setChartOptions();

    this.chart = new Chart(this.chartTrends.nativeElement.getContext('2d'), {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions
      });

    // Get dataset configuration
    this.datasetConfig = this.dsService.getDatasetConfig(this.widgetProperties.config.datasetUUID);
    if (this.datasetConfig) {
      // Get historical data
      const dsData: IDatasetServiceDataset[] = this.dsService.getHistoricalData(this.widgetProperties.config.datasetUUID);

      // Transform, convert to units data and load chart dataset data
      this.lineChartData.datasets.forEach((dataset, dsIndex) => dataset.data = this.transformDataset(dsData, dsIndex));
      this.startStreaming();
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.indexAxis = this.widgetProperties.config.verticalGraph ? 'y' : 'x';

    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        parsing: {
          yAxisKey: 'value',
        },
        tension: 0,
      }
    );

    if (this.widgetProperties.config.displayEMADataset) {
      this.lineChartData.datasets.push(
        {
          label: 'EMA',
          data: [],
          parsing: {
            yAxisKey: 'ema'
          }
        }
      );
    }

    if (this.widgetProperties.config.displayDEMADataset) {
      this.lineChartData.datasets.push(
        {
          label: 'DEMA',
          data: [],
          parsing: {
            yAxisKey: 'doubleEma'
          }
        }
      );
    }

    this.lineChartOptions.scales = {
      x : {
        type: "time",
        time: {
          unit: "second",
          minUnit: "second",
          round: "second",
          displayFormats: {
            second: "ss ' sec'"
          }
        }
      },
      y : {
        position: "right",
        beginAtZero: this.widgetProperties.config.startScaleAtZero
      }
    }
    this.lineChartOptions.plugins = {
      annotation : {
        annotations: {
          averageLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.displayDatasetAverageValueLine,
            value: null,
            borderDash: [6, 6],
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true
            }
          },
          minimumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.startScaleAtZero ? false : this.widgetProperties.config.displayDatasetMinimumValueLine,
            value: null,
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true
            }
          },
          maximumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.displayDatasetMaximumValueLine,
            value: null,
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true
            }
          }
        }
      }
    }
  }

  private startStreaming(): void {
    this.dsServiceSub = this.dsService.getDatasetObservable(this.widgetProperties.uuid, this.widgetProperties.config.datasetUUID).subscribe(
      (dsPoint: IDatasetServiceDataset) => {
        if (!dsPoint) return; // we will get null back if we subscribe to a dataset before the app has started it. No need to update until we have values

        if (this.lineChartData.datasets[0].data.length >= this.datasetConfig.maxDataPoints) {
          this.lineChartData.datasets.forEach(dataset => dataset.data.shift());
        }

        // For each chart datasets; transform, convert to units of data point and load
        for (let i = 0; i < this.lineChartData.datasets.length; i++) {
          this.lineChartData.datasets[i].data.push(this.transformDatasetRow(dsPoint, i));
        }

        const lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastAverage);
        const lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMinimum);
        const lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMaximum);

        if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
          this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
          this.chart.options.plugins.annotation.annotations.averageLine.label.content = `Avg: ${Math.round(lastAverage)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.minimumLine.value != lastMinimum) {
          this.chart.options.plugins.annotation.annotations.minimumLine.value = lastMinimum;
          this.chart.options.plugins.annotation.annotations.minimumLine.label.content = `Min: ${Math.round(lastMinimum)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.maximumLine.value != lastMaximum) {
          this.chart.options.plugins.annotation.annotations.maximumLine.value = lastMaximum;
          this.chart.options.plugins.annotation.annotations.maximumLine.label.content = `Max: ${Math.round(lastMaximum)}`;
        }

        this.chart?.update('none');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
  }
}
