import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register();


import { DataSetService } from '../../data-set.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

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
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataAvg = [];
  chartDataMax = [];

  textColor; // store the color of text for the graph...

  dataSetSub: Subscription = null;

  constructor(private dataSetService: DataSetService) {
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
   }

  ngOnInit() {
    this.validateConfig();
    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');

    this.startChart();
    this.subscribeDataSet();
  }

  private startChart() {
    if (this.chart !== null) {
        this.chart.destroy();
    }

    // Setup DataSets
    let ds: IDataSetOptions[] = [
      {
        label: `${this.widgetProperties.config.displayName}-Avg.`,
        data: this.chartDataAvg,
        fill: 'false',
        borderColor: this.textColor,
      }
    ];

    // Min / max display options
    if (this.widgetProperties.config.displayMinMax) {
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
            ...(this.widgetProperties.config.includeZero && { beginAtZero: true}),
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
                round: 'second',
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

  private subscribeDataSet() {
      this.unsubscribeDataSet();
      if (this.widgetProperties.config.dataSetUUID === null) { return } // nothing to sub to...

      this.dataSetSub = this.dataSetService.subscribeDataSet(this.widgetProperties.uuid, this.widgetProperties.config.dataSetUUID).subscribe(
          dataSet => {
              if (dataSet === null) {
                return; // we will get null back if we subscribe to a dataSet before the app has started it. When it learns about it we will get first value
              }
              let invert = 1;
              if (this.widgetProperties.config.invertData) { invert = -1; }
              //Avg
              this.chartDataAvg = [];
              for (let i=0;i<dataSet.length;i++){
                if (dataSet[i].average === null) {
                  this.chartDataAvg.push({x: dataSet[i].timestamp, y: null });
                  continue;
                }
                this.chartDataAvg.push({
                  x: dataSet[i].timestamp,
            y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dataSet[i].average) * invert)
                });
              }
              this.chart.config.data.datasets[0].data = this.chartDataAvg;

              //min/max
              if (this.widgetProperties.config.displayMinMax) {
                this.chartDataMin = [];
                this.chartDataMax = [];
                for (let i=0;i<dataSet.length;i++){
                  //process datapoint and add it to our chart.
                  if (dataSet[i].average === null) {
                    this.chartDataMin.push({x: dataSet[i].timestamp, y: null });
                  } else {
                    this.chartDataMin.push({
                        x: dataSet[i].timestamp,
                y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dataSet[i].minValue) * invert)
                    });
                    this.chartDataMax.push({
                        x: dataSet[i].timestamp,
                y: (this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dataSet[i].maxValue) * invert)
                    });
                  }
                }
                this.chart.config.data.datasets[1].data = this.chartDataMin;
                this.chart.config.data.datasets[2].data = this.chartDataMax;
              }

            const average = arr => arr.reduce((p, c) => p + c, 0) / arr.length;
              //if (this.widgetConfig.animateGraph) {
              //  this.chart.update();
              //} else {
                // append the cumulated average to the label text
            this.chart.data.datasets[0].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataAvg.map(e => e.y)).toFixed(2) + "]";
            if (this.widgetProperties.config.displayMinMax) {
              this.chart.data.datasets[1].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataMin.map(e => e.y)).toFixed(2) + "]";
              this.chart.data.datasets[2].label = this.widgetProperties.config.displayName + " [" + average(this.chartDataMax.map(e => e.y)).toFixed(2) + "]";
            }
            this.chart.update('none');
              //}
          }
      );
  }

  private unsubscribeDataSet() {
    if (this.dataSetSub !== null) {
      this.dataSetSub.unsubscribe();
      this.dataSetSub = null;
    }
  }

  ngOnDestroy() {
    this.unsubscribeDataSet();
  }
}
