import { Component, OnInit, Input } from '@angular/core';
import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../../widgets-interface';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent extends BaseWidgetComponent implements DynamicWidget, OnInit {

  constructor() {
    super();

    this.defaultConfig = {
      displayName: ''
    };
  }

  ngOnInit() {
  }

}
