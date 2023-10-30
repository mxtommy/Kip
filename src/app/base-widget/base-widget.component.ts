import { Component, Input, inject } from '@angular/core';
import { Observable, Subscription, sampleTime } from 'rxjs';
import { SignalKService, pathRegistrationValue } from '../signalk.service';
import { UnitsService } from '../units.service';
import { ITheme, IWidget, IWidgetSvcConfig } from '../widgets-interface';


interface IWidgetDataStream {
  pathName: string;
  observable: Observable<pathRegistrationValue>;
};

@Component({
  template: ''
})
export abstract class BaseWidgetComponent {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  public defaultConfig: IWidgetSvcConfig = null;
  protected dataStream: Array<IWidgetDataStream> = [];
  private dataSubscription: Subscription = null;

  protected signalKService = inject(SignalKService);
  protected unitsService = inject(UnitsService);

  constructor() {
  }

  protected createDataOservable(): void {
    if (this.widgetProperties === undefined) return;

    Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
      if (typeof(this.widgetProperties.config.paths[pathKey].path) != 'string' || this.widgetProperties.config.paths[pathKey].path == '' || this.widgetProperties.config.paths[pathKey].path == null) {
        return;
      } else {
        this.dataStream.push({
          pathName: pathKey,
          observable: this.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths[pathKey].path, this.widgetProperties.config.paths[pathKey].source)
        });
      }
    })
  }

  protected observeDataStream(pathName: string, func: ((value) => void))  {
    const observer = {
      next: (x: pathRegistrationValue) => {
        if (this.widgetProperties.config.paths[pathName].pathType == 'number') {
          x.value = this.unitsService.convertUnit(this.widgetProperties.config.paths[pathName].convertUnitTo, x.value);
        }
        func(x)
      },
      error: err => console.error('Observer got an error: ' + err),
      complete: () => console.log('Observer got a complete notification: ' + pathName),
    };

    let pathObs = this.dataStream.find((stream: IWidgetDataStream) => {
      return stream.pathName === pathName;
    })

    if (pathObs === undefined) return;
    if (this.dataSubscription == null){
      this.dataSubscription = pathObs.observable.pipe(sampleTime(this.widgetProperties.config.paths[pathName].sampleTime)).subscribe(observer);
    } else {
      this.dataSubscription.add(pathObs.observable.subscribe(observer));
    }
  }

  protected unsubscribeDataOservable(): void {
    if (this.dataSubscription !== null) {
      this.dataSubscription.unsubscribe();
      // Cleanup KIP's pathRegister
      Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
        this.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths[pathKey].path);
        }
      );
    }
  }
}
