import { Component, Input, OnInit } from '@angular/core';

import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../widgets-interface';

@Component({
  selector: 'app-widget-iframe',
  templateUrl: './widget-iframe.component.html',
  styleUrls: ['./widget-iframe.component.css']
})
export class WidgetIframeComponent implements DynamicWidget, OnInit {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

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
