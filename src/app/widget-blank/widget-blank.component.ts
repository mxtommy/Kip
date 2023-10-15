import { Component, OnInit, Input } from '@angular/core';
import { IWidget, IWidgetSvcConfig } from '../widget-manager.service';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent implements OnInit {
  @Input('widgetProperties') widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: ''
  };

  constructor() {

  }

  ngOnInit() {
  }

}
