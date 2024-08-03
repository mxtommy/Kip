import { Component, Input, inject } from '@angular/core';
import { BehaviorSubject, Observable, Observer, Subject, Subscription, delayWhen, map, retryWhen, sampleTime, tap, throwError, timeout, timer } from 'rxjs';
import { DataService, IPathUpdate } from '../core/services/data.service';
import { UnitsService } from '../core/services/units.service';
import { ITheme, IWidget, IWidgetSvcConfig } from '../core/interfaces/widgets-interface';
import { ISkZone } from '../core/interfaces/signalk-interfaces';
import { cloneDeep, merge } from 'lodash-es';


interface IWidgetDataStream {
  pathName: string;
  observable: Observable<IPathUpdate>;
};

@Component({
  template: ''
})
export abstract class BaseWidgetComponent {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  public displayName$ = new Subject<string>;
  public zones$ = new BehaviorSubject<ISkZone[]>([]);


  /** Default Widget configuration Object properties. This Object is only used as the default configuration template when Widget is added in a KIP page. The default configuration will automatically be pushed to the AppSettings service (the configuration storage service). From then on, any configuration changes made by users using the Widget Options UI is stored in AppSettings service. defaultConfig will only be use from then on to insure missing properties are merged with their default values is needed insuring a safety net when adding new configuration properties. */
  public defaultConfig: IWidgetSvcConfig = undefined;
  /** Array of data paths use for observable automatic setup and cleanup */
  protected dataStream: Array<IWidgetDataStream> = undefined;
  /** Single Observable Subscription object for all data paths */
  private dataSubscriptions: Subscription = undefined;
  /** Single Observable Subscription object for all data paths */
  private metaSubscriptions: Subscription = undefined;
  /** Signal K data stream service to obtain/observe server data */
  protected DataService = inject(DataService);
  /** Unit conversion service to convert a wide range of numerical data formats */
  protected unitsService = inject(UnitsService);

  constructor() {
  }

  protected initWidget(): void {
    this.validateConfig();
  }

  private observeMeta(): void {
    if (this.widgetProperties && this.widgetProperties.config?.paths && Object.keys(this.widgetProperties.config.paths).length > 0) {
      const firstKey = Object.keys(this.widgetProperties.config.paths)[0];
      const path = this.widgetProperties.config.paths[firstKey].path;

      this.metaSubscriptions = this.DataService.getPathMetaObservable(path).subscribe(
        (meta) => {
          if (!meta) return;
          if (meta.zones) {
            this.zones$.next(meta.zones);
          }
        }
      );
    }
  }

  /**
   * This method is used to insure Widget configuration property model changes (not value)
   * are added to older versions of Widget configuration and limit breaking changes.
   *
   * The method compares Widget configuration (from saved storage config) with Widget
   * defaultConfig, adds missing defaultConfig properties and values recursively to
   * configuration.
   *
   * The changes are not persisted until the configuration is saved.
   *
   * @protected
   * @memberof BaseWidgetComponent
   */
  private validateConfig() {
    this.widgetProperties.config = cloneDeep(merge(this.defaultConfig, this.widgetProperties.config));
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
          observable: this.DataService.subscribePath(this.widgetProperties.config.paths[pathKey].path, this.widgetProperties.config.paths[pathKey].source)
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
  protected observeDataStream(pathName: string, subscribeNextFunction: ((value: IPathUpdate) => void))  {
    if (this.dataStream === undefined) {
      this.createDataObservable();
    }

    this.observeMeta();

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
          // filterNullish(),
          map(x => ({
            data: {
              value: this.unitsService.convertToUnit(convert, x.data.value),
              timestamp: x.data.timestamp
            },
            state: x.state
          })),
          sampleTime(widgetSample),
          timeout({
            each: dataTimeout,
            with: () =>
              throwError(() => {
                  console.log(timeoutErrorMsg + path);
                  this.DataService.timeoutPathObservable(path, pathType)
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
          // filterNullish(),
          map(x => ({
            data: {
              value: this.unitsService.convertToUnit(convert, x.data.value),
              timestamp: x.data.timestamp
            },
            state: x.state
          })),
          sampleTime(widgetSample),
        );
      }
    } else if (pathType == 'string' || pathType == 'Date') {
      if (this.widgetProperties.config.enableTimeout) {
        dataPipe$ = pathObs.observable.pipe(
          // filterNullish(),
          sampleTime(widgetSample),
          timeout({
            each: dataTimeout,
            with: () =>
              throwError(() => {
                  console.log(timeoutErrorMsg + path);
                  this.DataService.timeoutPathObservable(path, pathType)
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
          // filterNullish(),
          sampleTime(widgetSample),
        );
      }
    } else { // boolean
      dataPipe$ = pathObs.observable.pipe(
        // filterNullish(),
        sampleTime(widgetSample),
      );
    }

    if (this.dataSubscriptions === undefined) {
      this.dataSubscriptions = dataPipe$.subscribe(observer);
    } else {
      this.dataSubscriptions.add(dataPipe$.subscribe(observer));
    }
  }

  private buildObserver(pathKey: string, subscribeNextFunction: ((value: IPathUpdate) => void)): Observer<IPathUpdate> {
    const observer: Observer<IPathUpdate> = {
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
  protected formatWidgetNumberValue(v: any): string {
    // Check if v is not a number or is null or undefined
    if (typeof v !== 'number' || v == null) {
      return '';
    }

    // Limit value to Min/Max range
    v = Math.min(Math.max(v, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);

    // Convert to fixed decimal string
    const vStr = v.toFixed(this.widgetProperties.config.numDecimal);

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
    if (this.dataSubscriptions) {
      this.dataSubscriptions.unsubscribe();
      this.dataSubscriptions = undefined;
      this.dataStream = undefined;
    }

    this.metaSubscriptions?.unsubscribe();
    this.metaSubscriptions = undefined;
  }
}
