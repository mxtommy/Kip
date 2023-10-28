import { Component, Input, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { SignalKService, pathRegistrationValue } from '../signalk.service';
import { UnitsService } from '../units.service';
import { ITheme, IWidget, IWidgetSvcConfig } from '../widgets-interface';


interface IWidgetDataStream extends Array<{
  pathName: string;
  observable: Observable<pathRegistrationValue>;
  subscription: Subscription | null;
}> {};


@Component({
  template: ''
})
export abstract class BaseWidgetComponent {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  public defaultConfig: IWidgetSvcConfig = null;
  protected dataStream: Array<IWidgetDataStream> = [];

  protected signalKService = inject(SignalKService);
  protected unitsService = inject(UnitsService);

  constructor() {
    Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {

      console.log(pathKey);
      console.log(this.widgetProperties.config.paths[pathKey].path);

      if (typeof(this.widgetProperties.config.paths[pathKey].path) != 'string' || this.widgetProperties.config.paths[pathKey].path == '') {
        return;
      } else {
        this.dataStream.push({
          pathName: pathKey,
          observable: this.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths[pathKey].path, this.widgetProperties.config.paths[pathKey].source),
          subscription: null
        });
      }
    })
  }
}
