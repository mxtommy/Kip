import { Component, ComponentRef, Input, OnInit, ViewContainerRef } from '@angular/core';
import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../../widgets-interface';

@Component({
  selector: 'app-widget-tutorial',
  templateUrl: './widget-tutorial.component.html',
  styleUrls: ['./widget-tutorial.component.css']
})
export class WidgetTutorialComponent implements DynamicWidget, OnInit {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;
  @Input() unlockStatus: boolean;

  defaultConfig: IWidgetSvcConfig = {};
  constructor() { }

  ngOnInit() {
  }

}
