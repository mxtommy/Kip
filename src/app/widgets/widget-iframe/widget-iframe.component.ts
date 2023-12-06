import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-widget-iframe',
  templateUrl: './widget-iframe.component.html',
  styleUrls: ['./widget-iframe.component.css']
})
export class WidgetIframeComponent extends BaseWidgetComponent implements OnInit {
  widgetUrl: string = null;

  constructor() {
    super();

    this.defaultConfig = {
      widgetUrl: null
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.widgetUrl = this.widgetProperties.config.widgetUrl;
  }

}
