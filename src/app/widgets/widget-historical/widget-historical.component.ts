import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatasetService, IDatasetServiceDatapoint, IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register();

const lastAverage = arr => arr.reduce((p, c) => p + c, 0) / arr.length;
interface IDataSetOptions {
    label: string;
    data: any;
    fill: string;
    borderColor: any;
    borderDash?: number[];
}

@Component({
    selector: 'app-widget-historical',
    templateUrl: './widget-historical.component.html',
    styleUrls: ['./widget-historical.component.css'],
    standalone: true
})
export class WidgetHistoricalComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataValue = [];
  chartDataMax = [];

  textColor; // store the color of text for the graph...

  datasetConfig: IDatasetServiceDatasetConfig = null;
  dataSetSub: Subscription = null;

  constructor(private dsService: DatasetService) {
    super();

    this.defaultConfig = {
      displayName: 'Display Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      datasetUUID: null,
      invertData: false,
      showDatasetMinimumValueLine: false,
      startScaleAtZero: true,
      minValue: null,
      maxValue: null,
      verticalGraph: false,
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');

    // Get dataset configuration
    this.datasetConfig = this.dsService.get(this.widgetProperties.config.datasetUUID);
    if (this.datasetConfig) {
      // Load historical data
      const dsData: IDatasetServiceDatapoint[] = []//TODO: fox or flush this.dsService.getHistoricalData(this.widgetProperties.config.datasetUUID);
      this.chartDataValue = dsData;

      this.startChart();
      this.subscribeDataSource();
    }
  }

  private startChart() {
    // Setup DataSets
    let ds: IDataSetOptions[] = [
      {
        label: `${this.widgetProperties.config.displayName}-Val`,
        data: this.chartDataValue,
        fill: 'false',
        borderColor: this.textColor,
      }
    ];

    // Min / max display options
    if (this.widgetProperties.config.showDatasetMinimumValueLine) {
      ds.push(
        {
          label: `${this.widgetProperties.config.displayName}-Min`,
          data: this.chartDataMin,
          fill: '+1',
          borderColor: this.textColor,
        borderDash: [10, 10]
      },
      {
          label: `${this.widgetProperties.config.displayName}-Max`,
          data: this.chartDataMax,
          fill: '-1',
          borderColor: this.textColor,
        borderDash: [5, 5]
      }
      );
    }

    let xAxis = this.widgetProperties.config.verticalGraph ? 'y' : 'x';
    let yAxis = this.widgetProperties.config.verticalGraph ? 'x' : 'y';

    this.chart = new Chart(this.chartCtx,{
      type: 'line',
      data: {
        datasets: ds
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: this.widgetProperties.config.verticalGraph ? 'y' : 'x',
        parsing: {
          xAxisKey: xAxis,
          yAxisKey: yAxis,
        },
        scales: {
          [yAxis]: {
            position: this.widgetProperties.config.verticalGraph ? 'top' : 'right',
            ...(this.widgetProperties.config.minValue !== null && {suggestedMin: this.widgetProperties.config.minValue}),
            ...(this.widgetProperties.config.maxValue !== null && {suggestedMax: this.widgetProperties.config.maxValue}),
            ...(this.widgetProperties.config.startScaleAtZero && { beginAtZero: true}),
            ticks: {
              color: this.textColor,
              autoSkip: true,
              autoSkipPadding: 40
            }
          },
          [xAxis]: {
            position: this.widgetProperties.config.verticalGraph ? 'right': 'bottom',
            type: 'time',
            time: {
              minUnit: 'second',
              round: 'second'
            },
            ticks: {
              color: this.textColor,
              callback: timeDifferenceFromNow,
              autoSkip: true,
              autoSkipPadding: 40
              // maxTicksLimit: 5
            }
          }
        },
        plugins:{
          legend: {
            labels: {
              color: this.textColor,
            }
          }
        }
      }
    });

    function timeDifferenceFromNow(_value, index, values) {
      let tickTime = values[index].value;
      let nowTime = Date.now();
      let timeDiff = Math.floor((nowTime - tickTime) / 1000);
      if (timeDiff < 60) {
        return timeDiff.toString() + " sec ago";
      } else if (timeDiff < 3600) {
        let minDiff = Math.floor(timeDiff / 60);
        let secDiff = timeDiff % 60;
        return (minDiff.toString() + ":" + secDiff.toString().padStart(2, "0") + " min ago");
      } else if (timeDiff < 86400) {
        let hourDiff = Math.floor(timeDiff / 3600);
        return (hourDiff.toString() + " hour ago");
      } else {
        let dayDiff = Math.floor(timeDiff / 86400);
        return (dayDiff.toString() + " day ago");
      }
    }
  }

  private subscribeDataSource() {
    this.unsubscribeDataSource();
    if (this.widgetProperties.config.datasetUUID === null) { return } // nothing to sub to...

    this.dataSetSub = this.dsService.getDatasetObservable(this.widgetProperties.config.datasetUUID).subscribe(
      (dsDatasets: IDatasetServiceDatapoint) => {
        // console.log(this.chart);
        if (!dsDatasets) {
          // we will get null back if we subscribe to a dataset before the app
          // has started it. No need to update until we have values
          return;
        }

        if (this.chartDataValue.length > this.datasetConfig.maxDataPoints) {
          this.chartDataValue.shift();
        }

        let invert = 1;
        if (this.widgetProperties.config.invertData) { invert = -1; }

        // Values
          this.chartDataValue.push({
            x: dsDatasets.timestamp,
            y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsDatasets.data.value) * invert)
          });

        this.chart.config.data.datasets[0].data = this.chartDataValue;

        //min/max
        if (this.widgetProperties.config.showDatasetMinimumValueLine) {
          this.chartDataMin = [];
          this.chartDataMax = [];

          this.chartDataMin.push({
            x: Date.now(),
            y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsDatasets.data.lastMinimum) * invert)
          });

          this.chartDataMax.push({
            x: Date.now(),
            y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsDatasets.data.lastMaximum) * invert)
          });

          this.chart.config.data.datasets[1].data = this.chartDataMin;
          this.chart.config.data.datasets[2].data = this.chartDataMax;
        }

        // append the cumulated lastAverage to the label text
        this.chart.data.datasets[0].label = this.widgetProperties.config.displayName + " [" + lastAverage(this.chartDataValue.map(e => e.y)).toFixed(2) + "]";
        if (this.widgetProperties.config.showDatasetMinimumValueLine) {
          this.chart.data.datasets[1].label = this.widgetProperties.config.displayName + " [" + lastAverage(this.chartDataMin.map(e => e.y)).toFixed(2) + "]";
          this.chart.data.datasets[2].label = this.widgetProperties.config.displayName + " [" + lastAverage(this.chartDataMax.map(e => e.y)).toFixed(2) + "]";
        }
        this.chart.update('none');
      }
    );
  }

  private unsubscribeDataSource() {
    this.dataSetSub?.unsubscribe();
  }

  ngOnDestroy() {
    this.unsubscribeDataSource();
    this.chart?.destroy();
  }
}
