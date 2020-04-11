import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent implements OnInit {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  constructor() { }

  ngOnInit() {
  }

}
