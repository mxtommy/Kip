import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { DatasetService, IDatasetServiceDatasetConfig, IDatasetServiceDataset } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';


@Component({
  selector: 'widget-data-chart',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

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
        }
      },
      {
        label: 'seriesMaximum',
        data: [],
        parsing: {
          yAxisKey: 'seriesMaximum'
        }
      }
    ]
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: {
      xAxisKey: 'timestamp',
    },
    datasets: {
      line: {
        pointRadius: 0,
        pointHoverRadius: 0,
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
            value: 15,
            borderColor: 'red',
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true,
              content: "Maximum"
            }
          },
          minimumLine: {
            type: 'line',
            scaleID: 'y',
            value: 1,
            borderColor: 'green',
            drawTime: 'beforeDatasetsDraw',
            label: {
              display: true,
              content: "Minimum"
            }
          }
        }
      },
    }
  }
  public lineChartType: ChartType = 'line';
  private dsServiceSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;

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

        this.chart?.update('none');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
  }
}
