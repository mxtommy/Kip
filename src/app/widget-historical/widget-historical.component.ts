import { Component, OnInit } from '@angular/core';





@Component({
  selector: 'app-widget-historical',
  templateUrl: './widget-historical.component.html',
  styleUrls: ['./widget-historical.component.css']
})
export class WidgetHistoricalComponent implements OnInit {

  settingsForm = {
    availableDataSets: []
  }

  constructor() { }

  ngOnInit() {
  }

}
