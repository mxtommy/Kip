import { Injectable, OnDestroy } from '@angular/core';
import { Observable , BehaviorSubject, Subscription, ReplaySubject, Subject, map, combineLatest, of } from 'rxjs';
import { ISkPathData, IPathValueData, IPathMetaData, IMeta} from "../interfaces/app-interfaces";
import { ISignalKDataValueUpdate, ISignalKMetadata, ISignalKNotification, States, TState } from '../interfaces/signalk-interfaces'
import { SignalKDeltaService } from './signalk-delta.service';
import { cloneDeep, merge } from 'lodash-es';
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
  uuid: string;
  path: string;
  source: string;
  _pathValue$: BehaviorSubject<any>;
  _pathState$: BehaviorSubject<TState>;
  pathData$: BehaviorSubject<IPathData>; // pathValue and pathState combined subject for Observers ie: widgets
  _pathMeta$: BehaviorSubject<ISignalKMetadata>;
}

export interface IDeltaUpdate {
  value: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class SignalKDataService implements OnDestroy {
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

  // Full skData copy for data-browser component
  private _isSkDataFullTreeActive: boolean = false;
  private _skDataObservable$ = new BehaviorSubject<ISkPathData[]>([]);

  // Zones
  private _skNotificationMsg$ = new Subject<ISignalKDataValueUpdate>();
  private _skNotificationMeta$ = new Subject<IMeta>();
  private _isReset = new Subject<boolean>();

  // Service data variables
  private _selfUrn: string = 'self'; // self urn, should get updated on first delta or rest call.
  private _skData: ISkPathData[] = []; // Local array of paths containing received Signal K Data and used to source Observers
  private _pathRegister: IPathRegistration[] = []; // List of paths used by Kip (Widgets or App (Notifications and such))

  constructor(private deltaService: SignalKDeltaService) {
    // Emit Delta message update counter every second
    setInterval(() => {
      if (this._deltaUpdatesCounter !== null) {
        let update: IDeltaUpdate = {timestamp: Date.now(), value: this._deltaUpdatesCounter}
        this._deltaUpdatesSubject.next(update);
        this._deltaUpdatesCounter = 0;
      };
    }, 1000);

    // Observer of Delta service data path updates
    this._deltaServicePathSubscription = this.deltaService.subscribeDataPathsUpdates().subscribe((dataPath: IPathValueData) => {
      this.updatePathData(dataPath);
    });

    // Observer of Delta service Metadata updates
    this._deltaServiceMetaSubscription = this.deltaService.subscribeMetadataUpdates().subscribe((deltaMeta: IMeta) => {
      this.setMeta(deltaMeta);
    })

    // Observer router of Delta service Notification updates
    this._deltaServiceNotificationSubscription = this.deltaService.subscribeNotificationsUpdates().subscribe((msg: ISignalKDataValueUpdate) => {
      // Replace "notifications." with "self." to search for the path in skData
      const cleanedPath = msg.path.replace('notifications.', 'self.');

      const pathItem = this._skData.find(item => item.path == cleanedPath);
      if (pathItem && pathItem.state !== (msg.value as ISignalKNotification).state) {
        pathItem.state = (msg.value as ISignalKNotification).state;

        this._pathRegister.filter(item => item.path == cleanedPath).forEach(
          item => {
            item._pathState$.next(pathItem.state);
          }
        );
      }
      this._skNotificationMsg$.next(msg);
    });

    // Observer of vessel Self URN updates
    this._deltaServiceSelfUrnSubscription = this.deltaService.subscribeSelfUpdates().subscribe(self => {
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

  public resetSignalKData() {
    this._skData = [];
    this._selfUrn = 'self';
    this._isReset.next(true);
  }

  public unsubscribePath(uuid, path) {
    this._pathRegister.splice(this._pathRegister.findIndex(registration => registration.path === path && registration.uuid === uuid), 1);
  }

  public subscribePath(uuid: string, path: string, source: string): Observable<IPathData> {
    // TODO: check if we still need UUIDs for registration. Maybe we can just use the path.
    // See if already have a Subject for this path and return it.
    const entry = this._pathRegister.find(entry => (entry.path == path) && (entry.uuid == uuid));
    if (entry) { // exists
      return entry.pathData$;
    }

    let currentValue: any = null;
    let state = null;

    // Check if we already have this path. If so, return it's values
    const dataPath = this._skData.find(item => item.path == path);
    if (dataPath) { // exists
      if (source == 'default') {
        currentValue = dataPath.pathValue;
      } else if (source in dataPath.sources) {
        currentValue = dataPath.sources[source].sourceValue;
      } else {
        currentValue = dataPath; //  return the entire pathObject
      }
     dataPath.state ? state = dataPath.state : state = States.Normal;
    }

    let newRegister: IPathRegistration  = {
      uuid: uuid,
      path: path,
      source: source,
      _pathValue$: new BehaviorSubject<any>(currentValue),
      _pathState$: new BehaviorSubject<TState>(state),
      pathData$: new BehaviorSubject<IPathData>({ value: currentValue, state: state }),
      _pathMeta$: new BehaviorSubject<ISignalKMetadata>(dataPath?.meta || null)
    };

    // Combine the latest values and state of the path
    const combined$ = combineLatest([newRegister._pathValue$, newRegister._pathState$]).pipe(
      map(([v, s]) => {
        return { value: v, state: s } as IPathData;
      })
    );

    // Subscribe combined$ to newRegister.pathData$
    combined$.subscribe(value => newRegister.pathData$.next(value));

    this._pathRegister.push(newRegister);
    return newRegister.pathData$;
  }

  private setSelfUrn(value: string) {
    if ((value != "" || value != null) && value != this._selfUrn) {
      console.log('[Data Service] Setting self to: ' + value);
      this._selfUrn = value;
    }
  }

  private updatePathData(dataPath: IPathValueData): void {
    this._deltaUpdatesCounter++; // Increase delta updates stat counter
    let updatePath = this.setPathContext(dataPath.context, dataPath.path);

    // position data is sent as degrees. KIP expects everything to be in SI, so rad.
    if (updatePath.includes('position.latitude') || updatePath.includes('position.longitude')) {
      const degToRad = Qty.swiftConverter('deg', 'rad');
      dataPath.value =  degToRad(dataPath.value);
    }

    // See if path key exists
    let pathIndex = this._skData.findIndex(pathObject => pathObject.path == updatePath);
    if (pathIndex >= 0) { // exists

      if (this._skData[pathIndex].defaultSource === undefined) { // undefined means the path was first created to a Meta update. Meta updates don't contain source information so we set default source on first source data update.
        this._skData[pathIndex].defaultSource = dataPath.source;
      }
      if ((this._skData[pathIndex].type === undefined) && (dataPath.value !== null)) {
        // undefined means the path was first created by a Meta update. Meta updates don't
        // contain source information so we set default source on first source data update.
        // If the value is null, we don't set the value type yet as null is of type object
        // and it's not what we want. If null we wait to set the type when we get a value.
        this._skData[pathIndex].type = typeof(dataPath.value);

        // Manually set path string data type if of valid SK datetype
        if (typeof(dataPath.value) == "string") {
          if (isRfc3339StringDate(dataPath.value)) {
            this._skData[pathIndex].type = "Date";
          }
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
      this._skData[pathIndex].pathValue = dataPath.value;
      this._skData[pathIndex].sources[dataPath.source] = {
        timestamp: dataPath.timestamp,
        sourceValue: dataPath.value,
      };

    } else { // Doesn't exist. Add new path
      let pathType: string = typeof(dataPath.value);

      // set path data type to enhance data type identification of SK string datetime
      if (typeof(dataPath.value) == "string") {
        if (isRfc3339StringDate(dataPath.value)) {
          pathType = "Date";
        }
      }

      pathIndex = this._skData.push({
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
      }) - 1;
    }
    // push value to subscriptions registry
    this._pathRegister.filter(item => item.path == updatePath).forEach(
      item => {
        /**
         * Source of value 'default' is use to support SK path Priority feature by taking the pathValue
         * rather than the direct sourceValue. With Priority configured sources can change over time
         * based on priority.
         *
         * Source of value of 'default' should only be selectable in the Widget Options -> Paths -> Data Source
         * component if only one source exists. Having a single source or using 'default' has no impact as
         * as pathValue is always taken.
         *
         * If multiple sources are present, either Priorities have not been properly configured, or the
         * user does not want Priorities for the path. In this case individual sources must be selected
         * and 'default' should not be visible (hidden in the path selection component).
         */
        if (item.source == 'default') {
          item._pathValue$.next(this._skData[pathIndex].pathValue);
        } else if (item.source in this._skData[pathIndex].sources) {
          item._pathValue$.next(this._skData[pathIndex].sources[item.source].sourceValue);
        } else {
          //we're looking for a source we don't know about. Error out to console
          console.error(`[Data Service] Failed updating zone state. Source unknown or not defined for path: ${item.source}`);
        }
      }
    );

    // Push full tree if data-browser is observing
    this._isSkDataFullTreeActive ? this._skDataObservable$.next(this._skData) : null;
  }

  private setMeta(meta: IMeta): void {
    if (meta.path.startsWith("notifications.")) {
      this._skNotificationMeta$.next(meta);
    } else {
      const { context, path, meta: metaProp } = meta;
      const metaPath = this.setPathContext(context, path);
      let pathObject = this._skData.find(pathObject => pathObject.path === metaPath);

      if (pathObject) {
        pathObject.meta = merge(pathObject.meta, metaProp);
      } else { // not in our list yet. The Meta update came before the Source update.
        pathObject = this._skData.at(this._skData.push({
          path: metaPath,
          pathValue: undefined,
          defaultSource: undefined,
          sources: {},
          meta: metaProp,
          type: undefined,
          state: States.Normal
        }) - 1);
      }
      this._pathRegister.filter(registration => registration.path === metaPath).forEach(
        registration => registration._pathMeta$.next(pathObject.meta)
      );
    }
  }

  private setPathContext(context: string, path: string): string {
    let finalPath: string = `${SELFROOTDEF}.${path}`;
    if (context !== this._selfUrn) { // account for external context data (coming from AIS, etc.)
      finalPath = `${context}.${path}`;
    }
    return finalPath;
  }

  /**
   * Returns a list of all known Signal K paths of the specified type (sting or numeric)
   * @param valueType data type: string or numeric
   * @param selfOnly if true, returns only paths the begins with "self". If false or not specified, everything known
   * @return array of Signal K path string
   */
  public getPathsByType(valueType: string, selfOnly?: boolean): string[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let paths: string[] = [];
    for (let i = 0; i < this._skData.length;  i++) {
       if (this._skData[i].type == valueType) {
         if (selfOnly) {
          if (this._skData[i].path.startsWith("self")) {
            paths.push(this._skData[i].path);
          }
         } else {
          paths.push(this._skData[i].path);
         }
      }
    }
    return paths; // copy it....
  }

  public startSkDataFullTree(): Observable<ISkPathData[]> {
    this._isSkDataFullTreeActive = true;
    this._skDataObservable$.next(this._skData);
    return this._skDataObservable$.asObservable();
  }

  public stopSkDataFullTree(): void {
    if (!this._skDataObservable$.observed) {
      this._isSkDataFullTreeActive = false;
      this._skDataObservable$.next(null);
    }
  }

  public getPathsAndMetaByType(valueType: string, selfOnly?: boolean): IPathMetaData[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let pathsMeta: IPathMetaData[] = [];
    for (let i = 0; i < this._skData.length;  i++) {
       if (this._skData[i].type == valueType) {
         if (selfOnly) {
          if (this._skData[i].path.startsWith("self")) {
            let p: IPathMetaData = {
              path: this._skData[i].path,
              meta: this._skData[i].meta,
            };
            pathsMeta.push(p);
          }
         } else {
          let p:IPathMetaData = {
            path: this._skData[i].path,
            meta: this._skData[i].meta,
          };
          pathsMeta.push(p);
         }
      }
    }
    return pathsMeta; // copy it....
  }

  public getPathObject(path: string): ISkPathData {
    const pathObject = this._skData.find(pathObject => pathObject.path == path);
    return pathObject ? cloneDeep(pathObject) : null;
  }

 public getPathUnitType(path: string): string {
  const pathObject = this._skData.find(pathObject => pathObject.path == path);
  return pathObject?.meta?.units || null;
}

  public timeoutPathObservable(path: string, pathType: string): void {
    // push it to any subscriptions of that data
    this._pathRegister.filter(_pathRegister => _pathRegister.path == path).forEach(
      _pathRegister => {

        let timeoutValue: IPathData;

        switch (pathType) {
          case 'string':
              timeoutValue = {value: null, state: States.Normal}
            break;

          case 'Date':
              timeoutValue = {value: null, state: States.Normal}
            break;

          case 'boolean':
              // do nothing
            break;

          case 'number':
            timeoutValue = {value: null, state: States.Normal}
            break;

          default:
            break;
        }

        _pathRegister.pathData$.next(timeoutValue);
      }
    )
  }

  public getNotificationMsg(): Observable<ISignalKDataValueUpdate> {
    return this._skNotificationMsg$.asObservable();
  }

  public getNotificationMeta(): Observable<IMeta> {
    return this._skNotificationMeta$.asObservable();
  }

  public getPathMeta(path: string): Observable<ISignalKMetadata> {
    const registration = this._pathRegister.find(registration => registration.path == path);
    return registration?._pathMeta$.asObservable() || of(null);
  }

  public IsResetService(): Observable<boolean> {
    return this._isReset.asObservable();
  }

  ngOnDestroy(): void {
    this._defaultUnitsSub?.unsubscribe();
    this._deltaUpdatesSubject?.unsubscribe();
    this._deltaServiceSelfUrnSubscription?.unsubscribe();
    this._deltaServiceMetaSubscription?.unsubscribe();
    this._deltaServicePathSubscription?.unsubscribe();
    this._deltaServiceNotificationSubscription?.unsubscribe();
    clearInterval(this._deltaUpdatesCounterTimer);
  }
}
