import { DestroyRef, inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, ReplaySubject, Subject, map, combineLatest, of, interval, Subscription } from 'rxjs';
import { ISkPathData, IPathValueData, IPathMetaData, IMeta } from "../interfaces/app-interfaces";
import { ISignalKDataValueUpdate, ISkMetadata, ISignalKNotification, States, TState } from '../interfaces/signalk-interfaces'
import { SignalKDeltaService } from './signalk-delta.service';
import { cloneDeep, merge } from 'lodash-es';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const SELFROOTDEF = "self";

export interface IPathUpdate {
  data: IPathData;
  /** The state of the data sent by SK, as per server Zones definitions. Defaults to 'normal' if no zones are defined, or if the value does not match any zone. */
  state: TState;
};

interface IPathData {
  /** The path value */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  /** The value's timestamp Date Object (in Zulu time). */
  timestamp: Date | null;
}
export interface IDataState {
  path: string;
  state: TState
}

// Validation of Signal K RFC3339S datetype format
const isRfc3339StringDate = (date: Date | string): boolean => {
  if (isFinite(+(date instanceof Date ? date : new Date(date)))) {
    // eslint-disable-next-line no-useless-escape
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

// Translate units from sk metadata to appropriate type category
const typeFromUnits = (units: string): string => {
  if (!units) {
    return undefined;
  }
  // So far the only thing that has units and isn't a number is a Date.
  if (units === "RFC 3339 (UTC)") {
    return "Date";
  }
  return "number";
};

/**
 * The `IPathRegistration` interface represents a registration object used to track a path's Subjects.
 * Each registration is used to share the same Subject with multiple Observers.
 * The `subscribePath()` and `unsubscribePath()` methods return the registration's subject as an Observable.
 *
 * @property {string} path - A Signal K path.
 * @property {string} source - The Signal K data path source. This is used when multiple sources exist for the same path. If set, the Signal K default source will be ignored.
 * @property {BehaviorSubject<IPathData>} _pathData$ - A BehaviorSubject of the private path value.
 * @property {BehaviorSubject<TState>} _pathState$ - A BehaviorSubject of the private path data state property.
 * @property {BehaviorSubject<IPathUpdate>} pathDataUpdate$ - A BehaviorSubject that contains path value and value state.
 * @property {BehaviorSubject<ISkMetadata | null>} pathMeta$ - A BehaviorSubject containing available meta or null.
 *
 * @interface IPathRegistration
 */
interface IPathRegistration {
  path: string;
  source: string;
  _pathData$: BehaviorSubject<IPathData>;
  _pathState$: BehaviorSubject<TState>;
  pathDataUpdate$: BehaviorSubject<IPathUpdate>;
  pathMeta$: BehaviorSubject<ISkMetadata | null>;
  combinedSub?: Subscription; // explicit subscription for combined$ to allow manual teardown
}

export interface IDeltaUpdate {
  value: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService implements OnDestroy {
  private delta = inject(SignalKDeltaService);
  private readonly _destroyRef = inject(DestroyRef);

  // Performance stats
  private _deltaUpdatesCounter = 0;
  private _deltaUpdatesSubject = new ReplaySubject<IDeltaUpdate>(10);

  // Full skData updates for data-browser component
  private _isSkDataFullTreeActive = false;
  private _skDataSubject$ = new BehaviorSubject<ISkPathData[]>([]);

  // Full skMeta updates for Zones component
  private _dataServiceMeta: IPathMetaData[] = [];
  private _isSkMetaFullTreeActive = false;
  private _dataServiceMetaSubject$ = new BehaviorSubject<IPathMetaData[]>([]);

  // Notifications
  private _skNotificationMsg$ = new Subject<ISignalKDataValueUpdate>();
  private _skNotificationMeta$ = new Subject<IMeta>();
  private _isReset = new Subject<boolean>();

  // Service data variables
  private _selfUrn = 'self'; // self urn, should get updated on first delta or rest call.
  private _skData: ISkPathData[] = []; // Local array of paths containing received Signal K Data and used to source Observers
  private _pathRegister: IPathRegistration[] = []; // List of paths used by Kip (Widgets or App (Notifications and such))

  constructor() {
    // Emit Delta message update counter every second (RxJS based)
    interval(1000).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
      const update: IDeltaUpdate = { timestamp: Date.now(), value: this._deltaUpdatesCounter };
      this._deltaUpdatesSubject.next(update);
      this._deltaUpdatesCounter = 0;
    });

    // Observer of Delta service data path updates
    this.delta.subscribeDataPathsUpdates().pipe(takeUntilDestroyed(this._destroyRef)).subscribe((dataPath: IPathValueData) => {
      this.updatePathData(dataPath);
    });

    // Observer of Delta service Metadata updates
    this.delta.subscribeMetadataUpdates().pipe(takeUntilDestroyed(this._destroyRef)).subscribe((deltaMeta: IMeta) => {
      this.setMeta(deltaMeta);
    })

    // Observer router of Delta service Notification updates
    this.delta.subscribeNotificationsUpdates().pipe(takeUntilDestroyed(this._destroyRef)).subscribe((msg: ISignalKDataValueUpdate) => {
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
    this.delta.subscribeSelfUpdates().pipe(takeUntilDestroyed(this._destroyRef)).subscribe(self => {
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
    const index = this._pathRegister.findIndex(registration => registration.path === path);

    if (index !== -1) {
      const registration = this._pathRegister[index];

      // Ensure all observables are completed to avoid memory leaks
      registration.combinedSub?.unsubscribe();
      registration._pathData$?.complete();
      registration._pathState$?.complete();
      registration.pathDataUpdate$?.complete();
      registration.pathMeta$?.complete();

      // Use splice to remove the item without changing the entire
      // array reference.
      this._pathRegister.splice(index, 1);
    }
  }

  public subscribePath(path: string, source: string): Observable<IPathUpdate> {
    const matchingPaths = this._pathRegister.find(item => item.path === path && item.source === source);
    if (matchingPaths) {
      return matchingPaths.pathDataUpdate$;
    }

    let currentValue: string = null;
    let currentTimestamp: string = null;
    let currentDateTimestamp: Date | null = null;
    let state: TState = States.Normal;
    let pathUpdate: IPathUpdate = {
      data: {
        value: null,
        timestamp: null
      },
      state: state
    };
    let metaUpdate: ISkMetadata = null;

    const dataPath = this._skData.find(item => item.path == path);

    if (this._skData.length && dataPath) {
      currentValue = source === 'default' ? dataPath.pathValue : dataPath.sources?.[source]?.sourceValue ?? null;
      currentTimestamp = source === 'default' ? dataPath.pathTimestamp : dataPath.sources?.[source]?.sourceTimestamp ?? null;
      currentDateTimestamp = currentTimestamp ? new Date(currentTimestamp) : null;

      pathUpdate = {
        data: {
          value: currentValue,
          timestamp: currentDateTimestamp
        },
        state: dataPath.state || state
      };

      state = dataPath.state || state;
      metaUpdate = dataPath.meta || null;
    }

    const newPathSubject: IPathRegistration = {
      path: path,
      source: source,
      _pathData$: new BehaviorSubject<IPathData>(pathUpdate.data),
      _pathState$: new BehaviorSubject<TState>(pathUpdate.state),
      pathDataUpdate$: new BehaviorSubject<IPathUpdate>(pathUpdate),
      pathMeta$: new BehaviorSubject<ISkMetadata>(metaUpdate)
    };

    const combined$ = combineLatest([newPathSubject._pathData$, newPathSubject._pathState$]).pipe(
      map(([d, s]) => ({ data: d, state: s } as IPathUpdate))
    );

    newPathSubject.combinedSub = combined$.subscribe(value => newPathSubject.pathDataUpdate$.next(value));

    this._pathRegister.push(newPathSubject);
    return newPathSubject.pathDataUpdate$;
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

    // Find the path item in _skData or create a new one if it doesn't exist
    let pathItem = this._skData.find(pathObject => pathObject.path == updatePath);
    if (!pathItem) {
      let pathType: string = typeof (dataPath.value);
      if (pathType === "string" && isRfc3339StringDate(dataPath.value)) {
        pathType = "Date";
      }

      pathItem = {
        path: updatePath,
        pathValue: dataPath.value,
        pathTimestamp: dataPath.timestamp,  // timestamp of the last update. Be mindful of source priorities
        defaultSource: dataPath.source,
        type: pathType,
        state: States.Normal,
        sources: {
          [dataPath.source]: {
            sourceTimestamp: dataPath.timestamp,
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
        pathItem.type = typeof (dataPath.value);
        if (pathItem.type === "string" && isRfc3339StringDate(dataPath.value)) {
          pathItem.type = "Date";
        }
      }
      pathItem.pathValue = dataPath.value;
      pathItem.pathTimestamp = dataPath.timestamp;
      pathItem.sources[dataPath.source] = {
        sourceTimestamp: dataPath.timestamp,
        sourceValue: dataPath.value,
      };
    }

    // Update path register Subjects with new data
    const pathRegisterItems = this._pathRegister.filter(item => item.path === updatePath);
    if (pathRegisterItems.length) {
      const pathData: IPathData = {
        value: pathItem.pathValue,
        timestamp: new Date(pathItem.pathTimestamp)
      };

      const defaultSource = pathRegisterItems.find(item => item.source === "default");
      if (defaultSource) {
        defaultSource._pathData$.next(pathData);
      }

      const thisSource = pathRegisterItems.find(item => item.source === dataPath.source);
      if (thisSource) {
        thisSource._pathData$.next(pathData);
      }
    }

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
          pathTimestamp: undefined,
          type: typeFromUnits(meta.meta.units),
          state: States.Normal,
          defaultSource: undefined,
          sources: {},
          meta: meta.meta,
        };
        this._skData.push(pathObject);
      } else {
        if (pathObject.type === 'object' && meta.meta.units) {
          pathObject.type = typeFromUnits(meta.meta.units);
        }
        pathObject.meta = merge(pathObject.meta, meta.meta);
      }

      const entry = this._pathRegister.find(entry => entry.path === metaPath);
      if (entry) {
        entry.pathMeta$.next(pathObject.meta);
      }

      // If full meta tree is active, push the full tree
      if (this._isSkMetaFullTreeActive) {
        this._dataServiceMeta.push({ path: metaPath, meta: pathObject.meta });
        this._dataServiceMetaSubject$.next(this._dataServiceMeta);
      }
    }
  }

  public startSkMetaFullTree(): Observable<IPathMetaData[]> {
    this._isSkMetaFullTreeActive = true;

    this._dataServiceMeta = this._skData
      .filter(item => item.meta !== undefined && item.path.startsWith('self.'))
      .map(item => ({ path: item.path, meta: item.meta }));

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
  }

  private setSelfUrn(value: string) {
    if (value !== "" && value !== null) {
      console.debug('[Signal K Data Service] Setting self to: ' + value);
      this._selfUrn = value;
    } else {
      console.error('[Signal K Data Service] Invalid self URN: ' + value);
    }
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

  public getPathsAndMetaByType(valueType: string, supportsPutOnly?: boolean, selfOnly?: boolean): IPathMetaData[] {
    return this._skData
      .filter(item => {
        const typeMatches = item.type === valueType;
        const selfMatches = !selfOnly || item.path.startsWith("self");
        const supportsPutMatches = supportsPutOnly === true ? item.meta?.supportsPut === true : true;
        return typeMatches && selfMatches && supportsPutMatches;
      })
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
      let timeoutValue: IPathUpdate;

      if (['string', 'Date', 'number'].includes(pathType)) {
        timeoutValue = {
          data: {
            value: null,
            timestamp: null
          },
          state: States.Normal
        };
      }

      pathRegister.pathDataUpdate$.next(timeoutValue);
    }
  }

  public getNotificationMsgObservable(): Observable<ISignalKDataValueUpdate> {
    return this._skNotificationMsg$.asObservable();
  }

  public getNotificationMetaObservable(): Observable<IMeta> {
    return this._skNotificationMeta$.asObservable();
  }

  public getPathMetaObservable(path: string): Observable<ISkMetadata | null> {
    const registration = this._pathRegister.find(registration => registration.path == path);
    return registration?.pathMeta$.asObservable() || of(null);
  }

  /**
   * Fetches the metadata for a given path from the _skData array.
   *
   * @param {string} path - The path for which to fetch the metadata.
   *
   * @returns {ISkMetadata | null} The metadata object for the given path if found, otherwise null.
   */
  public getPathMeta(path: string): ISkMetadata | null {
    return this._skData.find(item => item.path === path)?.meta || null;
  }

  public isResetService(): Observable<boolean> {
    return this._isReset.asObservable();
  }

  ngOnDestroy(): void {
    this._deltaUpdatesSubject?.complete();
    this._skNotificationMsg$?.complete();
    this._skNotificationMeta$?.complete();
    this._isReset?.complete();
    this._skDataSubject$?.complete();
    this._dataServiceMetaSubject$?.complete();
  }
}
