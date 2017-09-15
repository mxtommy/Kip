import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import Chart from 'chart.js';

import { DataSetService } from '../data-set.service';



@Component({
  selector: 'app-widget-historical',
  templateUrl: './widget-historical.component.html',
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent implements OnInit {

  @ViewChild('lineGraph') lineGraph: ElementRef;

  chartCtx;
  chart;

  settingsForm = {
    availableDataSets: [],
    selectedDataSet: null
  }

  chartData = [];

  constructor(
    private DataSetService: DataSetService
  ) { }

  ngOnInit() {

    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');
    this.chart = new Chart(this.chartCtx,{
      type: 'line',
      data: {
          datasets: [{
              label: 'Depth',
              data: this.chartData,
              fill: false,
              //borderWidth: 1
          }]
      },
      options: {
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero:true
                  }
              }],
              xAxes: [{
                  type: 'time',
                  time: {
                      minUnit: 'second'
                  }
                  
              }]
          }
      }
    });


  }

}
