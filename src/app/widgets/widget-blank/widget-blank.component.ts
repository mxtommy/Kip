import { Component, OnInit } from '@angular/core';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

@Component({
    selector: 'app-widget-blank',
    templateUrl: './widget-blank.component.html',
    styleUrls: ['./widget-blank.component.css'],
    imports: [ WidgetHostComponent ],
    standalone: true
})
//TODO: Is a blank widget still needed?
export class WidgetBlankComponent extends BaseWidgetComponent implements OnInit {

  constructor() {
    super();

    this.defaultConfig = {
      displayName: ''
    };
  }

  ngOnInit(): void {
    this.initWidget();
  }

  protected startWidget(): void {
    // Do nothing
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
  }

}
