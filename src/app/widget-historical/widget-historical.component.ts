import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input, Inject } from '@angular/core';
import * as Chart from 'chart.js';
import { MatDialog } from '@angular/material';
import { Subscription } from 'rxjs';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';

import { dataPoint, DataSetService } from '../data-set.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';

const defaultConfig: IWidgetConfig = {
  displayName: null,
  units: {
    "dataset": "unitless"
  },
  dataSetUUID: null,
  invertData: false,
  displayMinMax: false,
  includeZero: true,
  minValue: null,
  maxValue: null
};

interface IDataSetOptions {
    label: string;
    data: any;
    fill: string;
    //borderWidth: 1
    borderColor: any;
    borderDash?: number[];
}

@Component({
  selector: 'app-widget-historical',
  templateUrl: './widget-historical.component.html',
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  @ViewChild('lineGraph') lineGraph: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataAvg = [];
  chartDataMax = [];

  textColor; // store the color of text for the graph...

  dataSetSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  constructor(
    public dialog:MatDialog,
    private DataSetService: DataSetService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
  ) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }

    //TODO, this only works on chart init... need to find when theme changes...
    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;

    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');
    this.startChart();
    this.subscribeDataSet();
    //setTimeout(this.subscribeDataSet(),1000);//TODO, see why destroy called before we even get subbed (or just after...)
    this.subscribeTheme();

  }

  ngOnDestroy() {
      if (this.chart !== null) {
          //this.chart.destroy(); // doesn't seem to be needed since chart is destoryed when destroying component. was giving errors. (maybe html was destroyed before this is called?)
      }
      this.unsubscribeDataSet();
      console.log("stopped Sub");
      this.unsubscribeTheme();

  }

  startChart() {
      if (this.chart !== null) {
          this.chart.destroy();
      }
      // Setup DataSets
      let ds: IDataSetOptions[] = [
        {
          label: this.config.displayName + '-Avg.',
          data: this.chartDataAvg,
          fill: 'false',
          //borderWidth: 1
          borderColor: this.textColor
        }
      ];
      if (this.config.displayMinMax) {
        ds.push(
          {
            label: this.config.displayName + '-Min',
            data: this.chartDataMin,
            fill: '+1',
            //borderWidth: 1
            borderColor: this.textColor,
            borderDash: [ 5, 5 ]
        },
        {
            label: this.config.displayName + '-Max',
            data: this.chartDataMax,
            fill: '-1',
            //borderWidth: 1
            borderColor: this.textColor,
            borderDash: [ 5, 5 ]
        }
        );
      }
      //setup Options
      let yAxisTickOptions = {};
      if (this.config.includeZero) {
        yAxisTickOptions['beginAtZero'] = true;
      }
      if (this.config.minValue !== null) {
        yAxisTickOptions['suggestedMin'] = this.config.minValue;
      }
      if (this.config.maxValue !== null) {
        yAxisTickOptions['suggestedMax'] = this.config.maxValue;
      }

      this.chart = new Chart(this.chartCtx,{
          type: 'line',
          data: {
              datasets: ds
      },
      options: {
          maintainAspectRatio: false,
          scales: {
              yAxes: [{
                  scaleLabel: {
                      labelString: 'feet',
                  },

                  position: 'right',
                  ticks: yAxisTickOptions
              }],
              xAxes: [{
                  type: 'time',
                  time: {
                      minUnit: 'second',
                      round: 'second',
                      displayFormats: 'YY', //no mater what it seems to default to full time...
                  },

                  ticks: {
  //                    minRotation: 15,
                      callback: function(value) {  //TODO, left pad 0 for min/sec
                          let tickTime = Date.parse(value);
                          let nowTime = Date.now();
                          let timeDiff = Math.floor((nowTime - tickTime)/1000);
                          if (timeDiff < 60) {
                              return timeDiff.toString() + " sec ago";
                          } else if (timeDiff < 3600) {
                              let minDiff = Math.floor(timeDiff / 60);
                              let secDiff = timeDiff % 60;
                              return (minDiff.toString() + ":" +secDiff.toString() + " mins ago");
                          } else if (timeDiff < 86400) {
                              let hourDiff = Math.floor(timeDiff / 3600);
                              return (hourDiff.toString() + " hours ago");
                          } else {
                              let dayDiff = Math.floor(timeDiff / 86400);
                              return (dayDiff.toString() + " days ago");
                          }
                      }
                  }
              }]
          }
      }
    });

  }


  subscribeDataSet() {
      this.unsubscribeDataSet();
      if (this.config.dataSetUUID === null) { return } // nothing to sub to...

      this.dataSetSub = this.DataSetService.subscribeDataSet(this.widgetUUID, this.config.dataSetUUID).subscribe(
          dataSet => {
              if (dataSet === null) {
                return; // we will get null back if we subscribe to a dataSet before the app has started it.when it learns about it we will get first value
              }
              let invert = 1;
              if (this.config.invertData) { invert = -1; }
              //Avg
              this.chartDataAvg = [];
              for (let i=0;i<dataSet.length;i++){
                if (dataSet[i].average === null) {
                  this.chartDataAvg.push({t: dataSet[i].timestamp, y: null });
                  continue;
                }
                this.chartDataAvg.push({
                  t: dataSet[i].timestamp,
                  y: (this.UnitsService.convertUnit(this.config.units['dataset'], dataSet[i].average) * invert).toFixed(2)
                });
              }
              this.chart.config.data.datasets[0].data = this.chartDataAvg;

              //min/max
              if (this.config.displayMinMax) {
                this.chartDataMin = [];
                this.chartDataMax = [];
                for (let i=0;i<dataSet.length;i++){
                  //process datapoint and add it to our chart.
                  if (dataSet[i].average === null) {
                    this.chartDataMin.push({t: dataSet[i].timestamp, y: null });
                    this.chartDataMax.push({t: dataSet[i].timestamp, y: null });
                  } else {
                    this.chartDataMin.push({
                        t: dataSet[i].timestamp,
                        y: (this.UnitsService.convertUnit(this.config.units['dataset'], dataSet[i].minValue) * invert).toFixed(2)
                    });
                    this.chartDataMax.push({
                        t: dataSet[i].timestamp,
                        y: (this.UnitsService.convertUnit(this.config.units['dataset'], dataSet[i].maxValue) * invert).toFixed(2)
                    });
                  }
                }
                this.chart.config.data.datasets[1].data = this.chartDataMin;
                this.chart.config.data.datasets[2].data = this.chartDataMax;
              }


              //if (this.widgetConfig.animateGraph) {
              //  this.chart.update();
              //} else {
                this.chart.update(0);
              //}
          }
      );
  }

  unsubscribeDataSet() {
      if (this.dataSetSub !== null) {
          this.dataSetSub.unsubscribe();
          this.dataSetSub = null;
      }
  }


// Subscribe to theme event
subscribeTheme() {
  this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
    themeChange => {
     setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
      this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
      this.startChart()
     }, 100);
  })
}

unsubscribeTheme(){
  if (this.themeNameSub !== null) {
    this.themeNameSub.unsubscribe();
    this.themeNameSub = null;
  }
}

  openWidgetSettings() {

    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.startChart(); //need to recreate chart to update options :P
        this.subscribeDataSet();
      }

    });

    }

}
