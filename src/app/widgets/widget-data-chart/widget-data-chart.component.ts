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
  private transformDataset = (rawDs: IDatasetServiceDataset[], datasetIndex: number) => {
    let newDs = [];
    rawDs.map(row => {
      newDs.push(this.transformDatasetRow(row, datasetIndex));
    });
    return newDs;
  };
  private transformDatasetRow = (row: IDatasetServiceDataset, datasetType: number) => {
    const newRow: {timestamp: number,value?: number, sma?: number, seriesAverage?: number, seriesMinimum?: number, seriesMaximum?: number} = {
      timestamp: row.timestamp
    };

    switch (datasetType) {
      case 0:
        newRow.value = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
        break;

      case 1:
        newRow.sma = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.sma);
        break;

      case 2:
        newRow.seriesAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.seriesAverage);
        break;

      case 3:
        newRow.seriesMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.seriesMinimum);
        break;

      case 4:
        newRow.seriesMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.seriesMaximum);
        break;

      default: newRow.value = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
        break;
    }
    return newRow;
  };

  // @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('chartTrends', {static: true, read: ElementRef}) chartTrends: ElementRef;

  public lineChartData: ChartData <'line', {timestamp: number, value?: number, sma?: number, seriesAverage?: number, seriesMinimum?: number, seriesMaximum?: number } []> = {
    datasets: [
      {
        label: 'Value',
        data: [],
        parsing: {
          yAxisKey: 'value',
        },
        tension: 0,
      },
      {
        label: 'SMA',
        data: [],
        parsing: {
          yAxisKey: 'sma'
        }
      },
      {
        label: 'seriesAverage',
        data: [],
        parsing: {
          yAxisKey: 'seriesAverage'
        }
      },
      {
        label: 'seriesMinimum',
        data: [],
        parsing: {
          yAxisKey: 'seriesMinimum'
        },
        hidden: true
      },
      {
        label: 'seriesMaximum',
        data: [],
        parsing: {
          yAxisKey: 'seriesMaximum'
        },
        hidden: true
      }
    ],
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
    },
    plugins: {
      annotation: {
        annotations: {
          maximumLine: {
            type: 'line',
            scaleID: 'y',
            value: null,
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true,
              content: "Max: 10"
            }
          },
          minimumLine: {
            type: 'line',
            scaleID: 'y',
            value: null,
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true,
              content: "Min: 9"
            }
          }
        }
      },
    }
  }
  public lineChartType: ChartType = 'line';
  private chart;
  private dsServiceSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;


  constructor(private dsService: DatasetService) {
    super();

    this.defaultConfig = {
      displayName: 'Display Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      dataSetUUID: null,
      invertData: false,
      displayMinMax: false,
      includeZero: true,
      minValue: null,
      maxValue: null,
      verticalGraph: false,
    };

    Chart.register(annotationPlugin);
   }

  ngOnInit(): void {
    this.validateConfig();
    this.setChartOptions();

    this.chart = new Chart(
      this.chartTrends.nativeElement.getContext('2d'),
      {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions,
      }
    );

    // Get dataset configuration
    this.datasetConfig = this.dsService.getDatasetConfig(this.widgetProperties.config.dataSetUUID);
    if (this.datasetConfig) {
      // Get historical data
      const dsData: IDatasetServiceDataset[] = this.dsService.getHistoricalData(this.widgetProperties.config.dataSetUUID);

      // Transform, convert to units data and load chart dataset data
      this.lineChartData.datasets.forEach((dataset, dsIndex) => dataset.data = this.transformDataset(dsData, dsIndex));
      this.startStreaming();
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.indexAxis = this.widgetProperties.config.verticalGraph ? 'y' : 'x';

    this.lineChartOptions.scales = {
      x : {
        type: 'time',
        time: {
          minUnit: 'second',
          round: 'second'
        }
      },
      y : {
        position: 'right',
        beginAtZero: true
      }
    }
  }

  private startStreaming(): void {
    this.dsServiceSub = this.dsService.getDatasetObservable(this.widgetProperties.uuid, this.widgetProperties.config.dataSetUUID).subscribe(
      (dsDatasets: IDatasetServiceDataset) => {
        if (!dsDatasets) return; // we will get null back if we subscribe to a dataset before the app has started it. No need to update until we have values

        if (this.lineChartData.datasets[0].data.length >= this.datasetConfig.maxDataPoints) {
          this.lineChartData.datasets.forEach(dataset => dataset.data.shift());
        }

        // For each dataset; transform, convert to units and load
        this.lineChartData.datasets.forEach((dataset, dsIndex) => {
          dataset.data.push(this.transformDatasetRow(dsDatasets, dsIndex));
        });

        if (this.chart.options.plugins.annotation.annotations.minimumLine.value ! = (this.lineChartData.datasets[3].data[this.lineChartData.datasets[3].data.length - 1])) {
          this.chart.options.plugins.annotation.annotations.minimumLine.value = this.lineChartData.datasets[3].data[this.lineChartData.datasets[3].data.length - 1].seriesMinimum;
        }
        if (this.chart.options.plugins.annotation.annotations.maximumLine.value ! = (this.lineChartData.datasets[4].data[this.lineChartData.datasets[4].data.length - 1])) {
          this.chart.options.plugins.annotation.annotations.maximumLine.value = this.lineChartData.datasets[4].data[this.lineChartData.datasets[4].data.length - 1].seriesMaximum;
        }

        this.chart?.update('none');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
  }
}
