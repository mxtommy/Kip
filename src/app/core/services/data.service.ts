import { Injectable, OnDestroy } from '@angular/core';
import { Observable , BehaviorSubject, Subscription, ReplaySubject, Subject, map, combineLatest, of, from, filter, mergeMap, toArray, take, concatMap, switchMap, distinctUntilChanged, tap } from 'rxjs';
import { ISkPathData, IPathValueData, IPathMetaData, IMeta} from "../interfaces/app-interfaces";
import { ISignalKDataValueUpdate, ISkMetadata, ISignalKNotification, ISkZone, States, TState } from '../interfaces/signalk-interfaces'
import { SignalKDeltaService } from './signalk-delta.service';
import { cloneDeep, isEqual, merge } from 'lodash-es';
import Qty from 'js-quantities';

const SELFROOTDEF: string = "self";

export interface IPathData {
  value: any;
  state: TState;
};

export interface IDataState {
  path: string;
  state: TState
}

// Validation of Signal K RFC3339S datetype format
const isRfc3339StringDate = (date: Date | string): boolean => {
  if (isFinite(+(date instanceof Date ? date : new Date(date)))) {
    const rfc3339 = new RegExp("^([0-9]+)-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])[Tt]([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(([Zz])|([\+|\-]([01][0-9]|2[0-3]):[0-5][0-9]))$");
    if (rfc3339.test(date as string)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

/**
 * A path registration is an object used to track a path's Subjects. Each registration
 * is used to share the same Subject to multiple Observers using subscribePath()
 * and unsubscribePath() methods which returns the registration's subject as an
 * Observable.
 *
 * @param {string} uuid The UUID for the widget registering the path
 * @param {string} path A Signal K path
 * @param {string} source Set Signal K data path source when multiple sources exists for the same path. If set, the Signal K default source will be ignored.
 * @param {string} subject A rxjs BehaviorSubject of Type IPathData used to return Observable
 * @interface pathRegistration
 */
interface IPathRegistration {
  path: string;
  source: string;
  _pathValue$: BehaviorSubject<any>;
  _pathState$: BehaviorSubject<TState>;
  pathData$: BehaviorSubject<IPathData>; // pathValue and pathState combined subject for Observers ie: widgets
  pathMeta$: BehaviorSubject<ISkMetadata>;
}

export interface IDeltaUpdate {
  value: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService implements OnDestroy {
  // Service subscriptions
  private _deltaServiceSelfUrnSubscription: Subscription = null;
  private _deltaServiceMetaSubscription: Subscription = null;
  private _deltaServicePathSubscription: Subscription = null;
  private _deltaServiceNotificationSubscription: Subscription = null;
  private _defaultUnitsSub: Subscription = null;

  // Performance stats
  private _deltaUpdatesCounter: number = null;
  private _deltaUpdatesSubject: ReplaySubject<IDeltaUpdate> = new ReplaySubject(60);
  private _deltaUpdatesCounterTimer = null;

  // Full skData updates for data-browser component
  private _isSkDataFullTreeActive: boolean = false;
  private _skDataSubject$ = new BehaviorSubject<ISkPathData[]>([]);

  // Full skMeta updates for Zones component
  private _dataServiceMeta: IPathMetaData[] = [];
  private _isSkMetaFullTreeActive: boolean = false;
  private _dataServiceMetaSubject$ = new BehaviorSubject<IPathMetaData[]>([]);

  // Notifications
  private _skNotificationMsg$ = new Subject<ISignalKDataValueUpdate>();
  private _skNotificationMeta$ = new Subject<IMeta>();
  private _isReset = new Subject<boolean>();

  // Service data variables
  private _selfUrn: string = 'self'; // self urn, should get updated on first delta or rest call.
  private _skData: ISkPathData[] = []; // Local array of paths containing received Signal K Data and used to source Observers
  private _pathRegister: IPathRegistration[] = []; // List of paths used by Kip (Widgets or App (Notifications and such))

  constructor(private delta: SignalKDeltaService) {
    // Emit Delta message update counter every second
    setInterval(() => {
      if (this._deltaUpdatesCounter !== null) {
        const update: IDeltaUpdate = {timestamp: Date.now(), value: this._deltaUpdatesCounter}
        this._deltaUpdatesSubject.next(update);
        this._deltaUpdatesCounter = 0;
      }
    }, 1000);

    // Observer of Delta service data path updates
    this._deltaServicePathSubscription = this.delta.subscribeDataPathsUpdates().subscribe((dataPath: IPathValueData) => {
      this.updatePathData(dataPath);
    });

    // Observer of Delta service Metadata updates
    this._deltaServiceMetaSubscription = this.delta.subscribeMetadataUpdates().subscribe((deltaMeta: IMeta) => {
      this.setMeta(deltaMeta);
    })

    // Observer router of Delta service Notification updates
    this._deltaServiceNotificationSubscription = this.delta.subscribeNotificationsUpdates().subscribe((msg: ISignalKDataValueUpdate) => {
      const cleanedPath = msg.path.replace('notifications.', 'self.');

      const pathItem = this._skData.find(item => item.path == cleanedPath);
      if (pathItem && pathItem.state !== (msg.value as ISignalKNotification).state) {
        pathItem.state = (msg.value as ISignalKNotification).state;

        const pathRegisterItem = this._pathRegister.find(item => item.path == cleanedPath);
        if (pathRegisterItem) {
          pathRegisterItem._pathState$.next(pathItem.state);
        }
      }

      this._skNotificationMsg$.next(msg);
    });

    // Observer of vessel Self URN updates
    this._deltaServiceSelfUrnSubscription = this.delta.subscribeSelfUpdates().subscribe(self => {
      this.setSelfUrn(self);
    });
  }

  /**
   * Returns an Observable emitting the total amount of the Signal K Delta messages received
   * every second. Upon subscription, the Observable will automatically return
   * the last 60 seconds of captured data, followed by live data updates every seconds.
   *
   *
   * @return {*}  {Observable<number>} Count of delta messages received in the last second.
   * @memberof SignalKDataService
   */
  public getSignalkDeltaUpdateStatistics(): Observable<IDeltaUpdate> {
    return this._deltaUpdatesSubject.asObservable();
  }

  private resetSignalKData() {
    this._skData = [];
    this._selfUrn = 'self';
    this._isReset.next(true);
  }

  public unsubscribePath(path: string): void {
    this._pathRegister.splice(this._pathRegister.findIndex(registration => registration.path === path), 1);
  }

  public subscribePath(path: string, source: string): Observable<IPathData> {
    const entry = this._pathRegister.find(entry => entry.path == path);
    if (entry) {
      return entry.pathData$;
    }

    const dataPath = this._skData.find(item => item.path == path);
    const currentValue = source === 'default' ? dataPath?.pathValue : dataPath?.sources?.[source]?.sourceValue ?? dataPath;
    const state = dataPath?.state || States.Normal;

    const newPathSubject: IPathRegistration  = {
      path: path,
      source: source,
      _pathValue$: new BehaviorSubject<any>(currentValue),
      _pathState$: new BehaviorSubject<TState>(state),
      pathData$: new BehaviorSubject<IPathData>({ value: currentValue, state: state }),
      pathMeta$: new BehaviorSubject<ISkMetadata>(dataPath?.meta || null)
    };

    const combined$ = combineLatest([newPathSubject._pathValue$, newPathSubject._pathState$]).pipe(
      map(([v, s]) => ({ value: v, state: s } as IPathData))
    );

    combined$.subscribe(value => newPathSubject.pathData$.next(value));

    this._pathRegister.push(newPathSubject);
    return newPathSubject.pathData$;
  }

  private setSelfUrn(value: string) {
    if (value && value !== this._selfUrn) {
      this._selfUrn = value;
    }
  }

  /**
   * IMPORTANT: We should always push to both pathValue and source's sourceValue. This is required
   * as per SK specifications. By default, KIP uses the source "default". This
   * means, read from the pathValue property, and not the sourceValue. In KIP's
   * path selection component, users can also choose a specific source. This will
   * force KIP to read data from the sourceValue and disregard pathValue.
   *
   * If we have multiple sources for a path and KIP's source is configured to use
   * "default", KIP will read data from pathValue. In this case, this means that
   * KIP's pathValue will be overwritten overwritten by both sources, potentially
   * cause erratic widget behaviors!
   *
   * This is, as per SK specifications, by design. Source priority must/should
   * be configured in Signal K server to prevent this. Once configured, only one
   * source will update at a time following priority settings making the pathValue
   * (KIP's "default" source setting) behave accordingly. Else, user should select
   * a specific source to read from. This feature allows configurations where multiple
   * source can collaborate to a single path based on priority. Such as if you have
   * multiple GPS, and one goes down: SK priority will switch sources, and KIP
   * (configured with "default" source) will continue reading as if nothing ever
   * happened.
  */
  private updatePathData(dataPath: IPathValueData): void {
    this._deltaUpdatesCounter++;
    const updatePath = this.setPathContext(dataPath.context, dataPath.path);

    // Convert position values from degrees to radians
    if (updatePath.includes('position.latitude') || updatePath.includes('position.longitude')) {
      const degToRad = Qty.swiftConverter('deg', 'rad');
      dataPath.value = degToRad(dataPath.value);
    }

    // Find the path item in _skData or create a new one if it doesn't exist
    let pathItem = this._skData.find(pathObject => pathObject.path == updatePath);
    if (!pathItem) {
      let pathType: string = typeof(dataPath.value);
      if (pathType === "string" && isRfc3339StringDate(dataPath.value)) {
        pathType = "Date";
      }

      pathItem = {
        path: updatePath,
        pathValue: dataPath.value,
        defaultSource: dataPath.source,
        type: pathType,
        state: States.Normal,
        sources: {
          [dataPath.source]: {
            timestamp: dataPath.timestamp,
            sourceValue: dataPath.value
          }
        }
      };

      this._skData.push(pathItem);
    } else {
      // Update the existing path item
      if (pathItem.defaultSource === undefined) {
        pathItem.defaultSource = dataPath.source;
      }
      if (pathItem.type === undefined && dataPath.value !== null) {
        pathItem.type = typeof(dataPath.value);
        if (pathItem.type === "string" && isRfc3339StringDate(dataPath.value)) {
          pathItem.type = "Date";
        }
      }
      pathItem.pathValue = dataPath.value;
      pathItem.sources[dataPath.source] = {
        timestamp: dataPath.timestamp,
        sourceValue: dataPath.value,
      };
    }

    // Update path register Subjects with new data
    this._pathRegister.filter(item => item.path == updatePath).forEach(
      item => {
        if (item.source === 'default' || item.source in pathItem.sources) {
          item._pathValue$.next(pathItem.sources[item.source]?.sourceValue || pathItem.pathValue);
        } else {
          console.error(`[Data Service] Failed updating zone state. Source unknown or not defined for path: ${item.source}`);
        }
      }
    );

    // Push full tree if data-browser or Zones component are observing
    if (this._isSkDataFullTreeActive) {
      this._skDataSubject$.next(this._skData);
    }
  }

  private setMeta(meta: IMeta): void {
    if (meta.path.startsWith("notifications.")) {
      this._skNotificationMeta$.next(meta);
    } else {
      const metaPath = this.setPathContext(meta.context, meta.path);
      let pathObject = this._skData.find(pathObject => pathObject.path === metaPath);

      if (!pathObject) { // not in our list yet. The Meta update came before the Source update.
        pathObject = {
          path: metaPath,
          pathValue: undefined,
          defaultSource: undefined,
          sources: {},
          meta: meta.meta,
          type: undefined,
          state: States.Normal
        };
        this._skData.push(pathObject);
      } else {
        pathObject.meta = merge(pathObject.meta, meta.meta);
      }

      const entry = this._pathRegister.find(entry => entry.path === metaPath);
      if (entry) {
        entry.pathMeta$.next(pathObject.meta);
      }

      // If full meta tree is active, push the full tree
      if (this._isSkMetaFullTreeActive) {
        this._dataServiceMeta.push({path: metaPath, meta: pathObject.meta});
        this._dataServiceMetaSubject$.next(this._dataServiceMeta);
      }
    }
  }

  public startSkMetaFullTree(): Observable<IPathMetaData[]> {
    this._isSkMetaFullTreeActive = true;

    this._dataServiceMeta = this._skData
      .filter(item => item.meta !== undefined && item.path.startsWith('self.'))
      .map(item => ({path: item.path, meta: item.meta}));

    this._dataServiceMetaSubject$.next(this._dataServiceMeta);
    return this._dataServiceMetaSubject$;
  }

  public stopSkMetaFullTree(): void {
    this._isSkMetaFullTreeActive = false;
    this._dataServiceMetaSubject$.next(null);
    this._dataServiceMeta = null;
  }

  public startSkDataFullTree(): Observable<ISkPathData[]> {
    this._isSkDataFullTreeActive = true;
    this._skDataSubject$.next(this._skData);
    return this._skDataSubject$;
  }

  public stopSkDataFullTree(): void {
    this._isSkDataFullTreeActive = false;
    this._skDataSubject$.next(null);
  }

  private setPathContext(context: string, path: string): string {
    const finalPath = context !== this._selfUrn ? `${context}.${path}` : `${SELFROOTDEF}.${path}`;
    return finalPath;
  }

  /**
   * Returns a list of all known Signal K paths of the specified type (sting or numeric)
   * @param valueType data type: string or numeric
   * @param selfOnly if true, returns only paths the begins with "self". If false or not specified, everything known
   * @return array of Signal K path string
   */
  public getPathsByType(valueType: string, selfOnly?: boolean): string[] {
    return this._skData
      .filter(item => item.type === valueType && (!selfOnly || item.path.startsWith("self")))
      .map(item => item.path);
  }

  public getPathsAndMetaByType(valueType: string, selfOnly?: boolean): IPathMetaData[] {
    return this._skData
      .filter(item => item.type === valueType && (!selfOnly || item.path.startsWith("self")))
      .map(item => ({ path: item.path, meta: item.meta }));
  }

  public getPathObject(path: string): ISkPathData | null {
    return cloneDeep(this._skData.find(pathObject => pathObject.path === path)) || null;
  }

  public getPathUnitType(path: string): string | null {
    return this._skData.find(pathObject => pathObject.path === path)?.meta?.units || null;
  }

  /**
   * Set the value of a path to null and state to Normal. This is used to
   * timeout a path value and reset it to null. This is useful for widgets
   * that need to know if a path has timed out.
   *
   * @param {string} path The Signal K path to timeout
   * @param {string} pathType The type of the path value (string, Date, number)
   * @memberof SignalKDataService
   */
  public timeoutPathObservable(path: string, pathType: string): void {
    const pathRegister = this._pathRegister.find(item => item.path == path);
    if (pathRegister) {
      let timeoutValue: IPathData;

      if (['string', 'Date', 'number'].includes(pathType)) {
        timeoutValue = {value: null, state: States.Normal};
      }

      pathRegister.pathData$.next(timeoutValue);
    }
  }

  public getNotificationMsg(): Observable<ISignalKDataValueUpdate> {
    return this._skNotificationMsg$.asObservable();
  }

  public getNotificationMeta(): Observable<IMeta> {
    return this._skNotificationMeta$.asObservable();
  }

  public getPathMeta(path: string): Observable<ISkMetadata | null> {
    const registration = this._pathRegister.find(registration => registration.path == path);
    return registration?.pathMeta$.asObservable() || of(null);
  }

  public isResetService(): Observable<boolean> {
    return this._isReset.asObservable();
  }

  ngOnDestroy(): void {
    this._defaultUnitsSub?.unsubscribe();
    this._deltaUpdatesSubject?.unsubscribe();
    this._deltaServiceSelfUrnSubscription?.unsubscribe();
    this._deltaServiceMetaSubscription?.unsubscribe();
    this._deltaServicePathSubscription?.unsubscribe();
    this._deltaServiceNotificationSubscription?.unsubscribe();

    if (this._deltaUpdatesCounterTimer) {
      clearInterval(this._deltaUpdatesCounterTimer);
    }
  }
}
