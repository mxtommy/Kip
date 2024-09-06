import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { Component, OnInit } from '@angular/core';
import { SafePipe } from '../../core/pipes/safe.pipe';
import { NgIf } from '@angular/common';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

@Component({
    selector: 'widget-iframe',
    templateUrl: './widget-iframe.component.html',
    styleUrls: ['./widget-iframe.component.css'],
    standalone: true,
    imports: [WidgetHostComponent, NgIf, SafePipe]
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

  protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetUrl = this.widgetProperties.config.widgetUrl = config.widgetUrl;
  }

}
