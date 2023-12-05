import { Component, Input, inject } from '@angular/core';
import { Observable, Observer, OperatorFunction, Subscription, UnaryFunction, delayWhen, filter, map, pipe, retryWhen, sampleTime, tap, throwError, timeout, timer } from 'rxjs';
import { SignalKService, pathRegistrationValue } from '../signalk.service';
import { UnitsService } from '../units.service';
import { ITheme, IWidget, IWidgetSvcConfig } from '../widgets-interface';


interface IWidgetDataStream {
  pathName: string;
  observable: Observable<pathRegistrationValue>;
};

function filterNullish<T>(): UnaryFunction<Observable<T | null | undefined>, Observable<T>> {
  return pipe(
    filter(x => x != null) as OperatorFunction<T | null |  undefined, T>
  );
}

@Component({
  template: ''
})
export abstract class BaseWidgetComponent {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  /** Default Widget configuration Object properties. This Object is only used as a template once when Widget is added to KIP's UI and it is automatically pushed to the AppSettings service (the configuration storage service). From then on, any configuration changes made by users using the Widget Options UI are only stored in AppSettings service. defaultConfig is never used again. */
  public defaultConfig: IWidgetSvcConfig = undefined;
  /** Array of data paths use for observable automatic setup and cleanup */
  protected dataStream: Array<IWidgetDataStream> = undefined;
  /** Single Observable Subscription object for all data paths */
  private dataSubscription: Subscription = undefined;
  /** Signal K data stream service to obtain/observe server data */
  protected signalKService = inject(SignalKService);
  /** Unit conversion service to convert a wide range of numerical data formats */
  protected unitsService = inject(UnitsService);

  constructor() {
  }

  /**
   * Will iterate and creates all Widget Observables based on the Widget's widgetProperties.config.paths
   * child Objects definitions. If no widgetProperties.config.paths child Objects definitions
   * exists, execution returns without further execution.
   *
   * This method will be automatically called by observeDataStream() if it finds that no Observable
   * have been created.
   *
   * This method can be called manually if you are not using observeDataStream() and you are manually
   * handling Observer operations for your custom needs.
   *
   * @protected
   * @return {*}  {void}
   * @memberof BaseWidgetComponent
   */
  protected createDataObservable(): void {
    // check if Widget has properties
    if (this.widgetProperties === undefined) return;
    if (Object.keys(this.widgetProperties.config?.paths).length == 0) {
      this.dataStream = undefined;
      return;
    } else {
      this.dataStream = [];
    }

    Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
      // check if Widget has valid path
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

  /**
   * Use this method the subscribe to a Signal K data path Observable and receive a
   * live data stream from the server. This method apply
   * a combination of widgetProperties.config and widgetProperties.config.paths[pathName]
   * objects properties to setup the Observer. Ex: Widget min/max, decimal, combined with
   * path sampleTimes and conversions.
   *
   * @protected
   * @param {string} pathName the [key: string] name of the path IWidgetPath Object ie. paths: { "numericPath"... Look at you this.defaultConfig Object to identify the string key to use.
   * @param {((value) => void)} subscribeNextFunction The callback function for the Next notification delivered by the Observer. The function has the same properties as a standard subscribe callback function. ie. observer.subscribe( x => { console.log(x) } ).
   * @return {*}
   * @memberof BaseWidgetComponent
   */
  protected observeDataStream(pathName: string, subscribeNextFunction: ((value) => void))  {
    if (this.dataStream === undefined) {
      this.createDataObservable();
    }

    const pathType = this.widgetProperties.config.paths[pathName].pathType;
    const path = this.widgetProperties.config.paths[pathName].path;
    const convert = this.widgetProperties.config.paths[pathName].convertUnitTo;
    const widgetSample = this.widgetProperties.config.paths[pathName].sampleTime;
    const dataTimeout = this.widgetProperties.config.dataTimeout * 1000;
    const retryDelay = 5000;
    const timeoutErrorMsg = `[Widget] ${this.widgetProperties.config.displayName} - ${dataTimeout/1000} second data update timeout reached for `;
    const retryErrorMsg = `[Widget] ${this.widgetProperties.config.displayName} - Retrying in ${retryDelay/1000} secondes`;


    const observer = this.buildObserver(pathName, subscribeNextFunction);

    const pathObs = this.dataStream.find((stream: IWidgetDataStream) => {
      return stream.pathName === pathName;
    })

    // check Widget paths Observable(s)
    if (pathObs === undefined) return;

    let dataPipe$;
    // if numeric apply unit conversion
    if (pathType == 'number') {
      if (this.widgetProperties.config.enableTimeout) {
        dataPipe$ = pathObs.observable.pipe(
          filterNullish(),
          map(x => ({
            value: this.unitsService.convertUnit(convert, x.value),
            statue: x.state
          })),
          sampleTime(widgetSample),
          timeout({
            each: dataTimeout,
            with: () =>
              throwError(() => {
                  console.log(timeoutErrorMsg + path);
                  this.signalKService.timeoutPathObservable(path, pathType)
                }
              )
          }),
          retryWhen(error =>
            error.pipe(
              tap(() => console.log(retryErrorMsg)),
              delayWhen(() => timer(retryDelay))
            )
          )
        );
      } else {
        dataPipe$ = pathObs.observable.pipe(
          filterNullish(),
          map(x => ({
            value: this.unitsService.convertUnit(convert, x.value),
            statue: x.state
          })),
          sampleTime(widgetSample),
        );
      }
    } else if (pathType == 'string' || pathType == 'Date') {
      if (this.widgetProperties.config.enableTimeout) {
        dataPipe$ = pathObs.observable.pipe(
          filterNullish(),
          sampleTime(widgetSample),
          timeout({
            each: dataTimeout,
            with: () =>
              throwError(() => {
                  console.log(timeoutErrorMsg + path);
                  this.signalKService.timeoutPathObservable(path, pathType)
                }
              )
          }),
          retryWhen(error =>
            error.pipe(
              tap(() => console.log(retryErrorMsg)),
              delayWhen(() => timer(retryDelay))
            )
          )
        );
      } else {
        dataPipe$ = pathObs.observable.pipe(
          filterNullish(),
          sampleTime(widgetSample),
        );
      }
    } else { // boolean
      dataPipe$ = pathObs.observable.pipe(
        filterNullish(),
        sampleTime(widgetSample),
      );
    }

    if (this.dataSubscription === undefined) {
      this.dataSubscription = dataPipe$.subscribe(observer);
    } else {
      this.dataSubscription.add(dataPipe$.subscribe(observer));
    }
  }

  private buildObserver(pathKey: string, subscribeNextFunction: ((value) => void)): Observer<pathRegistrationValue> {
    const observer: Observer<pathRegistrationValue> = {
      next: (value) => subscribeNextFunction(value),
      error: err => console.error('[Widget] Observer got an error: ' + err),
      complete: () => console.log('[Widget] Observer got a complete notification: ' + pathKey),
    };
    return observer;
  }

  /**
   * This method will automatically ensure that Widget min/max values and decimal places
   * are applied. To respect decimal places a string must be returned, else trailing
   * zeros are stripped.
   *
   * @protected
   * @param {number} v the value to format
   * @return {*}  {string} the final output to display
   * @memberof BaseWidgetComponent
   */
  protected formatWidgetNumberValue(v: number): string {
    if (v == null || v === undefined || typeof(v) != "number") {return}
    // As per Widget config
    // - Limit value to Min/Max range
    if (v >= this.widgetProperties.config.maxValue) {
      v = this.widgetProperties.config.maxValue;
    } else if (v <= this.widgetProperties.config.minValue) {
      v = this.widgetProperties.config.minValue;
    }
    // Strip decimals but keep as a string type for blank trailing decimal positions
    let vStr: string = v.toFixed(this.widgetProperties.config.numDecimal);
    return vStr;
  }

  /**
   * Call this method to automatically unsubscribe all Widget Observers, cleanup KIP's Observable
   * registry and reset Widget Subscriptions to free resources.
   *
   * Should be called in ngOnDestroy().
   *
   * @protected
   * @memberof BaseWidgetComponent
   */
  protected unsubscribeDataStream(): void {
    if (this.dataSubscription !== undefined) {
      this.dataSubscription.unsubscribe();
      // Cleanup KIP's pathRegister
      Object.keys(this.widgetProperties.config.paths).forEach(pathKey => {
        this.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths[pathKey].path);
        }
      );
      this.dataSubscription = undefined;
      this.dataStream = undefined;
    }
  }
}
