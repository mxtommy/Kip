import { Component, OnInit, Input } from '@angular/core';
import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../../widgets-interface';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent implements DynamicWidget, OnInit {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: ''
  };

  constructor() {

  }

  ngOnInit() {
  }

}
