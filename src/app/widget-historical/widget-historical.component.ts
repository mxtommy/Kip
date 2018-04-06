import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input, Inject } from '@angular/core';
import Chart from 'chart.js';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';

import { dataPoint, DataSetService } from '../data-set.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface IHistoricalWidgetSettings {
  selectedDataSet: string;
  label: string;
  selectedUnitGroup: string;
  selectedUnitName: string;
  numDecimal: number;
  invertData: boolean;
  displayMinMax: boolean;
  animateGraph: boolean;
  suggestedMin: number;
  suggestedMax: number;
  includeZero: boolean;
}

interface widgetConfig {
  dataSetUUID: string;
  label: string;
  unitGroup: string;
  unitName: string;
  numDecimal: number; // number of decimal places if a number
  invertData: boolean;
  displayMinMax: boolean;
  animateGraph: boolean;
  suggestedMin: number;
  suggestedMax: number;  
  includeZero: boolean;
}

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
  
  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataAvg = [];
  chartDataMax = [];

  textColor; // store the color of text for the graph...

  converter = this.UnitConvertService.getConverter();
  dataSetSub: Subscription = null;

  widgetConfig: any = {
    dataSetUUID: null,
    label: '',
    unitGroup: 'discreet',
    unitName: 'no unit',
    numDecimal: 2,
    invertData: false,
    displayMinMax: false,
    animateGraph: false,
    suggestedMin: null,
    suggestedMax: null,
    includeZero: true
  }




  constructor(
    public dialog:MatDialog,
    private DataSetService: DataSetService,
    private WidgetManagerService: WidgetManagerService,
    private UnitConvertService: UnitConvertService
  ) { }

    ngOnInit() {
        this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
        if (this.activeWidget.config === null) {
            // no data, let's set some!
            this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
        } else {
            this.widgetConfig = this.activeWidget.config; // load existing config.
        }

        //TODO, this only works on chart init... need to find when theme changes...
        this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
        
        this.chartCtx = this.lineGraph.nativeElement.getContext('2d');
        this.startChart();
        setTimeout(this.subscribeDataSet(),1000);//TODO, see why destroy called before we even get subbed (or just after...)

    }

    ngOnDestroy() {
        if (this.chart !== null) {
            //this.chart.destroy(); // doesn't seem to be needed since chart is destoryed when destroying component. was giving errors. (maybe html was destroyed before this is called?)
        }
        this.unsubscribeDataSet();     
        console.log("stopped Sub");
    }

    startChart() {
        if (this.chart !== null) {
            this.chart.destroy();
        }
        // Setup DataSets
        let ds: IDataSetOptions[] = [
          {
            label: this.widgetConfig.label + '-Avg.',
            data: this.chartDataAvg,
            fill: 'false',
            //borderWidth: 1
            borderColor: this.textColor
          }
        ];
        if (this.widgetConfig.displayMinMax) {
          ds.push(
            {
              label: this.widgetConfig.label + '-Min',
              data: this.chartDataMin,
              fill: '+1',
              //borderWidth: 1
              borderColor: this.textColor,
              borderDash: [ 5, 5 ]
          },
          {
              label: this.widgetConfig.label + '-Max',
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
        if (this.widgetConfig.includeZero) {
          yAxisTickOptions['beginAtZero'] = true;
        }
        if (this.widgetConfig.suggestedMin !== null) {
          yAxisTickOptions['suggestedMin'] = this.widgetConfig.suggestedMin;
        }
        if (this.widgetConfig.suggestedMax !== null) {
          yAxisTickOptions['suggestedMax'] = this.widgetConfig.suggestedMax;
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
        //this.unsubscribeDataSet();
        if (this.widgetConfig.dataSetUUID === null) { return } // nothing to sub to...

        this.dataSetSub = this.DataSetService.subscribeDataSet(this.widgetUUID, this.widgetConfig.dataSetUUID).subscribe(
            dataSet => {
                
                if (dataSet === null) {
                return; // we will get null back if we subscribe to a dataSet before the app has started it.when it learns about it we will get first value
                }
                let invert = 1;
                if (this.widgetConfig.invertData) { invert = -1; }
                //Avg
                this.chartDataAvg = [];
                for (let i=0;i<dataSet.length;i++){
                  if (dataSet[i].average === null) {
                    this.chartDataAvg.push({t: dataSet[i].timestamp, y: null });
                    continue;
                  }
                  this.chartDataAvg.push({
                    t: dataSet[i].timestamp, 
                    y: this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](dataSet[i].average).toFixed(this.widgetConfig.numDecimal)*invert
                  });
                }
                this.chart.config.data.datasets[0].data = this.chartDataAvg;
                
                //min/max
                if (this.widgetConfig.displayMinMax) {
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
                          y: this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](dataSet[i].minValue).toFixed(this.widgetConfig.numDecimal)*invert
                      });
                      this.chartDataMax.push({
                          t: dataSet[i].timestamp, 
                          y: this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](dataSet[i].maxValue).toFixed(this.widgetConfig.numDecimal)*invert
                      });
                    }
                  }
                  this.chart.config.data.datasets[1].data = this.chartDataMin;
                  this.chart.config.data.datasets[2].data = this.chartDataMax;                   
                }


                if (this.widgetConfig.animateGraph) {
                  this.chart.update();
                } else {
                  this.chart.update(0);
                }
            }
        );
    }

    unsubscribeDataSet() {
        if (this.dataSetSub !== null) {
            this.dataSetSub.unsubscribe();
            this.dataSetSub = null;
        }
    }


    openWidgetSettings(content) {

        //prepare current data
        let settingsData: IHistoricalWidgetSettings = {
            selectedDataSet: this.widgetConfig.dataSetUUID,
            label: this.widgetConfig.label,
            numDecimal: this.widgetConfig.numDecimal,
            selectedUnitGroup: this.widgetConfig.unitGroup,
            selectedUnitName: this.widgetConfig.unitName,
            invertData: this.widgetConfig.invertData,
            displayMinMax: this.widgetConfig.displayMinMax,
            animateGraph: this.widgetConfig.animateGraph,
            suggestedMin: this.widgetConfig.suggestedMin,
            suggestedMax: this.widgetConfig.suggestedMax,
            includeZero: this.widgetConfig.includeZero
        };
        
        let dialogRef = this.dialog.open(WidgetHistoricalModalComponent, {
            width: '650px',
            data: settingsData
          });
      
          dialogRef.afterClosed().subscribe(result => {
            // save new settings
            if (result) {
                this.widgetConfig.dataSetUUID = result.selectedDataSet;
                this.widgetConfig.label = result.label;
                this.widgetConfig.unitGroup = result.selectedUnitGroup;
                this.widgetConfig.unitName = result.selectedUnitName;
                this.widgetConfig.numDecimal = result.numDecimal;
                this.widgetConfig.invertData = result.invertData;
                this.widgetConfig.displayMinMax = result.displayMinMax;
                this.widgetConfig.animateGraph = result.animateGraph;
                this.widgetConfig.includeZero = result.includeZero;
                
        
                if (typeof(result.suggestedMin) == 'number') {
                    this.widgetConfig.suggestedMin = result.suggestedMin;
                } else {
                    this.widgetConfig.suggestedMin = null;
                }
        
                if (typeof(result.suggestedMax) == 'number') {
                    this.widgetConfig.suggestedMax = result.suggestedMax;
                } else {
                    this.widgetConfig.suggestedMax = null;
                }
                this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);                
                this.startChart(); //need to recreate chart to update options :P
                this.subscribeDataSet();
            }

        });
    }

}








@Component({
selector: 'historical-widget-modal',
templateUrl: './widget-historical.modal.html',
styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalModalComponent implements OnInit {



    settingsData: IHistoricalWidgetSettings;
    availableDataSets: string[];
    availableUnitGroups: string[];
    availableUnitNames: string[];

    converter: Object = this.UnitConvertService.getConverter();
    
    constructor(
        private UnitConvertService: UnitConvertService,
        private DataSetService: DataSetService,
        public dialogRef:MatDialogRef<WidgetHistoricalModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }
    

    ngOnInit() {
        this.settingsData = this.data;

        this.availableUnitGroups = Object.keys(this.converter);
        if (this.converter.hasOwnProperty(this.settingsData.selectedUnitGroup)) {
                this.availableUnitNames = Object.keys(this.converter[this.settingsData.selectedUnitGroup]);
        }
        
        this.availableDataSets = this.DataSetService.getDataSets().sort();


    }

    updateUnitType() {
        this.availableUnitNames = Object.keys(this.converter[this.settingsData.selectedUnitGroup]);
        this.settingsData.selectedUnitName = this.availableUnitNames[0];
    }

    submitConfig() {
        this.dialogRef.close(this.settingsData);
    }

}