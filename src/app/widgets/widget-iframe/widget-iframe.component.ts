import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { Component, OnInit } from '@angular/core';
import { SafePipe } from '../../core/pipes/safe.pipe';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.css'],
    standalone: true,
    imports: [NgIf, SafePipe]
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
    this.initWidget();
    this.widgetUrl = this.widgetProperties.config.widgetUrl;
  }

}
