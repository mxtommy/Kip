import { Component, Input, inject } from '@angular/core';
import { Observable, Observer, Subscription, sampleTime } from 'rxjs';
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
  protected dataStream: Array<IWidgetDataStream> = null;
  private dataSubscription: Subscription = null;

  protected signalKService = inject(SignalKService);
  protected unitsService = inject(UnitsService);

  constructor() {
  }

  protected createDataOservable(): void {
    // check if Widget has properties
    if (this.widgetProperties === undefined) return;
    if (Object.keys(this.widgetProperties.config?.paths).length == 0) {
      this.dataStream = null;
      return;
    } else {
      this.dataStream = [];
    }

    Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
      // check if Widget has valide path
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
    if (this.dataStream == null) {
      this.createDataOservable();
    }

    const observer = this.buildObserver(pathName, func);

    let pathObs = this.dataStream.find((stream: IWidgetDataStream) => {
      return stream.pathName === pathName;
    })

    // check Widget paths Observable(s)
    if (pathObs === undefined) return;

    if (this.dataSubscription == null || this.dataSubscription.closed) {
      this.dataSubscription = pathObs.observable.pipe(sampleTime(this.widgetProperties.config.paths[pathName].sampleTime)).subscribe(observer);
    } else {
      this.dataSubscription.add(pathObs.observable.pipe(sampleTime(this.widgetProperties.config.paths[pathName].sampleTime)).subscribe(observer));
    }
  }

  private buildObserver(pathKey: string, func: ((value) => void)): Observer<pathRegistrationValue> {
    const observer: Observer<pathRegistrationValue> = {
      next: (x: pathRegistrationValue) => func(x),
      error: err => console.error('Observer got an error: ' + err),
      complete: () => console.log('Observer got a complete notification: ' + pathKey),
    };

    switch (this.widgetProperties.config.paths[pathKey].pathType) {
      case 'number':
        observer.next =
          (x: pathRegistrationValue) => {
            // TODO: Something looks broken in conversion (m/s - kph - mph) also (meters to feet, etc.) See Numeric Widget and Simple Linear widgets as exemples
            x.value  = this.unitsService.convertUnit(this.widgetProperties.config.paths[pathKey].convertUnitTo, x.value);
            func(x);
          }
        break;

      default:
        break;
    }
    return observer;
  }

  protected formatWidgetNumberValue(v: number): string {
    if (v == null) {return}
    // As per Widget config
    // - Limit value to Min/Max range
    if (v >= this.widgetProperties.config.maxValue) {
      v = this.widgetProperties.config.maxValue;
    } else if (v <= this.widgetProperties.config.minValue) {
      v = this.widgetProperties.config.minValue;
    }
    // - Strip decimals but keep as strong for format position
    let vStr: string = v.toFixed(this.widgetProperties.config.numDecimal);
    return vStr;
  }

  protected unsubscribeDataStream(): void {
    if (this.dataSubscription != null) {
      this.dataSubscription.unsubscribe();
      // Cleanup KIP's pathRegister
      Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
        this.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths[pathKey].path);
        }
      );
      this.dataSubscription = null;
      this.dataStream = null;
    }
  }
}
