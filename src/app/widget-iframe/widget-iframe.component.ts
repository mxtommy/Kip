import { Component, Input, OnInit } from '@angular/core';

import { IWidget, IWidgetSvcConfig } from '../widget-manager.service';

@Component({
  selector: 'app-widget-iframe',
  templateUrl: './widget-iframe.component.html',
  styleUrls: ['./widget-iframe.component.css']
})
export class WidgetIframeComponent implements OnInit {
  @Input('widgetProperties') widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    widgetUrl: null
  };

  widgetUrl: string = null;

  constructor() {
  }

  ngOnInit() {
    this.widgetUrl = this.widgetProperties.config.widgetUrl;
  }

}
