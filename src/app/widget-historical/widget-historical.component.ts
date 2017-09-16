import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input } from '@angular/core';
import Chart from 'chart.js';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs/Subscription';

import { dataPoint, DataSetService } from '../data-set.service';
import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface widgetSettingsForm {
  availableDataSets: string[];
  selectedDataSet: string;
  label: string;
  availableUnitGroups: string[];
  availableUnitNames: string[];
  selectedUnitGroup: string;
  selectedUnitName: string;
  numDecimal: number;
}

interface widgetConfig {
  dataSetUUID: string;
  label: string;
  unitGroup: string;
  unitName: string;
  numDecimal: number; // number of decimal places if a number
}


@Component({
  selector: 'app-widget-historical',
  templateUrl: './widget-historical.component.html',
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent implements OnInit, OnDestroy {

  @Input('nodeUUID') nodeUUID: string;

  @ViewChild('lineGraph') lineGraph: ElementRef;

  chartCtx;
  chart = null;

  chartDataMin = [];
  chartDataAvg = [];
  chartDataMax = [];

  modalRef;
  converter = this.UnitConvertService.getConverter();
  dataSetSub: Subscription = null;

  settingsForm: widgetSettingsForm = {
    availableDataSets: [],
    selectedDataSet: null,
    label: null,
    availableUnitGroups: Object.keys(this.converter),
    availableUnitNames: null,
    selectedUnitGroup: null,
    selectedUnitName: null,
    numDecimal: 2,
  }

  nodeConfig: widgetConfig = {
    dataSetUUID: null,
    label: '',
    unitGroup: 'discreet',
    unitName: 'no unit',
    numDecimal: 2
  }

  activePage: TreeNode;



  constructor(
    private DataSetService: DataSetService,
    private modalService: NgbModal, 
    private treeManager: TreeManagerService,
    private UnitConvertService: UnitConvertService
  ) { }

    ngOnInit() {
        this.activePage = this.treeManager.getNode(this.nodeUUID);
        if (this.activePage.nodeData === null) {
            // no data, let's set some!
            this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
        } else {
            this.nodeConfig = this.activePage.nodeData; // load existing config.
        }

        this.chartCtx = this.lineGraph.nativeElement.getContext('2d');
        this.startChart();
        setTimeout(this.subscribeDataSet(),1000);//TODO, see why destroy called before we even get subbed (or just after...)

    }

    ngOnDestroy() {
        if (this.chart !== null) {
            this.chart.destroy();
        }
        this.unsubscribeDataSet();     
        console.log("stopped Sub");
    }

    startChart() {
        if (this.chart !== null) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.chartCtx,{
            type: 'line',
            data: {
                datasets: [
                {
                    label: this.nodeConfig.label + '-Min',
                    data: this.chartDataMin,
                    fill: '+1',
                    //borderWidth: 1
                    borderColor: 'rgba(255, 0, 0, 0.5)'
        
                },
                {
                    label: this.nodeConfig.label + '-Avg.',
                    data: this.chartDataAvg,
                    fill: 'false',
                    //borderWidth: 1
                    borderColor: 'rgba(0, 255, 0, 1)'
                },
                {
                    label: this.nodeConfig.label + '-Max',
                    data: this.chartDataMax,
                    fill: '-1',
                    //borderWidth: 1
                    borderColor: 'rgba(0, 0, 255, 0.5)'
                }       
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                yAxes: [{
                    scaleLabel: {
                        labelString: 'feet',   
                    },
                    
                    position: 'right',
                    ticks: {
                        beginAtZero:true,
                        suggestedMin: -30
                    }
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
                        callback: function(value) {
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
        if (this.nodeConfig.dataSetUUID === null) { return } // nothing to sub to...

        this.dataSetSub = this.DataSetService.subscribeDataSet(this.nodeUUID, this.nodeConfig.dataSetUUID).subscribe(
            dataSet => {
                
                if (dataSet === null) {
                return; // we will get null back if we subscribe to a dataSet before the app has started it.when it learns about it we will get first value
                }

                this.chartDataMin = [];
                this.chartDataAvg = [];
                this.chartDataMax = [];
                for (let i=0;i<dataSet.length;i++){
                    //process datapoint and add it to our chart.
                    
                    if (dataSet[i].average === null) {
                        this.chartDataMin.push({t: dataSet[i].timestamp, y: null });
                        this.chartDataAvg.push({t: dataSet[i].timestamp, y: null });
                        this.chartDataMax.push({t: dataSet[i].timestamp, y: null });
                        this.chart.update(0); 
                        return;
                    }

                    this.chartDataMin.push({
                        t: dataSet[i].timestamp, 
                        y: this.converter[this.nodeConfig.unitGroup][this.nodeConfig.unitName](dataSet[i].minValue).toFixed(this.nodeConfig.numDecimal)*-1
                    });
                    this.chartDataAvg.push({
                        t: dataSet[i].timestamp, 
                        y: this.converter[this.nodeConfig.unitGroup][this.nodeConfig.unitName](dataSet[i].average).toFixed(this.nodeConfig.numDecimal)*-1
                    });
                    this.chartDataMax.push({
                        t: dataSet[i].timestamp, 
                        y: this.converter[this.nodeConfig.unitGroup][this.nodeConfig.unitName](dataSet[i].maxValue).toFixed(this.nodeConfig.numDecimal)*-1
                    });
                    
                }

                this.chart.config.data.datasets[0].data = this.chartDataMin;
                this.chart.config.data.datasets[1].data = this.chartDataAvg;
                this.chart.config.data.datasets[2].data = this.chartDataMax;
                this.chart.update(0);
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
        
        this.settingsForm.selectedDataSet = this.nodeConfig.dataSetUUID;
        this.settingsForm.label = this.nodeConfig.label;
        this.settingsForm.numDecimal = this.nodeConfig.numDecimal;
        this.settingsForm.availableUnitNames = Object.keys(this.converter[this.nodeConfig.unitGroup]);
        this.settingsForm.selectedUnitGroup = this.nodeConfig.unitGroup;
        this.settingsForm.selectedUnitName = this.nodeConfig.unitName;
        
        this.settingsForm.availableDataSets = this.DataSetService.getDataSets().sort();
        
        this.modalRef = this.modalService.open(content);
        this.modalRef.result.then((result) => {
        }, (reason) => {
        });
    }
    settingsFormUpdateUnitType() {
        this.settingsForm.availableUnitNames = Object.keys(this.converter[this.settingsForm.selectedUnitGroup]);
        this.settingsForm.selectedUnitName = this.settingsForm.availableUnitNames[0];
    }
 saveSettings() {
      this.modalRef.close();
      this.nodeConfig.dataSetUUID = this.settingsForm.selectedDataSet;
      this.nodeConfig.label = this.settingsForm.label;
      this.nodeConfig.unitGroup = this.settingsForm.selectedUnitGroup;
      this.nodeConfig.unitName = this.settingsForm.selectedUnitName;
      this.nodeConfig.numDecimal = this.settingsForm.numDecimal;
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
      this.subscribeDataSet();
  }




}
