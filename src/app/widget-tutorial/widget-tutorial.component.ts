import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-widget-tutorial',
  templateUrl: './widget-tutorial.component.html',
  styleUrls: ['./widget-tutorial.component.css']
})
export class WidgetTutorialComponent implements OnInit {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  constructor() { }

  ngOnInit() {
  }

}
