import { cloneDeep } from 'lodash-es';
import { Injectable } from '@angular/core';
import { Observable , BehaviorSubject, Subscription } from 'rxjs';
import { IPathData, IPathValueData, IPathMetaData, IDefaultSource, IMeta } from "./app-interfaces";
import { IZone, IZoneState } from './app-settings.interfaces';
import { AppSettingsService } from './app-settings.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { UnitsService, IUnitDefaults, IUnitGroup } from './units.service';
import { NotificationsService } from './notifications.service';
import Qty from 'js-quantities';

const SELFROOTDEF: string = "self";

export interface pathRegistrationValue {
  value: any;
  state: IZoneState;
};

// Validation of Signal K RFC3339S datetype format
const isRfc3339StringDate = (date: Date | string): boolean => {
  if (isFinite(+(date instanceof Date ? date : new Date(date)))) {
    let rfc3339 = new RegExp("^([0-9]+)-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])[Tt]([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(([Zz])|([\+|\-]([01][0-9]|2[0-3]):[0-5][0-9]))$");
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
 *
 * @param {string} uuid The UUID for the widget registering the path
 * @param {string} path A Signal K path
 * @param {string} source Set Signal K data path source when multiple sources exists for the same path. If set, the Signal K default source will be ignored.
 * @param {string} subject A rxjs BehaviorSubject of Type pathRegistrationValue used to return Observable
 * @interface pathRegistration
 */
interface pathRegistration {
  uuid: string;
  path: string;
  source: string;
  subject: BehaviorSubject<pathRegistrationValue>;
}

export interface updateStatistics {
  currentSecond: number; // number up updates in the last second
  secondsUpdates: number[]; // number of updates received for each of the last 60 seconds
  minutesUpdates: number[]; // number of updates received for each of the last 60 minutes

}

@Injectable({
  providedIn: 'root'
})
export class SignalKService {

  degToRad = Qty.swiftConverter('deg', 'rad');
  selfUrn: string = 'self'; // self urn, should get updated on first delta or rest call.

  // Local array of paths containing received Signal K Data and used to source Observers
  skData: IPathData[] = [];
  // List of paths used by Kip (Widgets or App (Notifications and such))
  pathRegister: pathRegistration[] = [];

  // path Observable
  skDataObservable: BehaviorSubject<IPathData[]> = new BehaviorSubject<IPathData[]>([]);

  // Performance stats
  updateStatistics: updateStatistics = {
    currentSecond: 0,
    secondsUpdates: [],
    minutesUpdates:  [],
  }
  secondsUpdatesBehaviorSubject: BehaviorSubject<number[]> = new BehaviorSubject<number[]>([]);
  minutesUpdatesBehaviorSubject: BehaviorSubject<number[]> = new BehaviorSubject<number[]>([]);

  defaultUnits: IUnitDefaults;
  defaultUnitsSub: Subscription;
  conversionList: IUnitGroup[];
  zonesSub: Subscription;
  zones: Array<IZone> = [];

  constructor(
    private appSettingsService: AppSettingsService,
    private deltaService: SignalKDeltaService,
    private notificationsService: NotificationsService,
    private unitService: UnitsService,
  )
  {
    //every second update the stats for seconds array
    setInterval(() => {

      // if seconds is more than 60 long, remove item
      if (this.updateStatistics.secondsUpdates.length >= 60) {
        this.updateStatistics.secondsUpdates.shift() //removes first item
      }
      this.updateStatistics.secondsUpdates.push(this.updateStatistics.currentSecond);
      this.updateStatistics.currentSecond = 0;
      this.secondsUpdatesBehaviorSubject.next(this.updateStatistics.secondsUpdates);
    }, 1000);

    // every minute update status for minute array
    setInterval(() => {

      // if seconds is more than 60 long, remove item
      if (this.updateStatistics.minutesUpdates.length >= 60) {
        this.updateStatistics.minutesUpdates.shift() //removes first item
      }
      this.updateStatistics.minutesUpdates.push(this.updateStatistics.secondsUpdates.reduce((a, b) => a + b, 0)); //sums the second array
      this.minutesUpdatesBehaviorSubject.next(this.updateStatistics.minutesUpdates)

    }, 60000);

    this.defaultUnitsSub = this.appSettingsService.getDefaultUnitsAsO().subscribe(
      newDefaults => {
        this.defaultUnits = newDefaults;
      }
    );

    this.conversionList = this.unitService.getConversions();

    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(zones => {
      this.zones = zones;
    });

    // Observer of Delta service data path updates
    this.deltaService.subscribeDataPathsUpdates().subscribe((dataPath: IPathValueData) => {
      this.updatePathData(dataPath);
    });

    // Observer of Delta service Metadata updates
    this.deltaService.subscribeMetadataUpdates().subscribe((deltaMeta: IMeta) => {
      this.setMeta(deltaMeta);
    })

    // Observer of vessel Self URN updates
    this.deltaService.subscribeSelfUpdates().subscribe(self => {
      this.setSelfUrn(self);
    });
  }

  getupdateStatsSecond() {
    return this.secondsUpdatesBehaviorSubject.asObservable();
  }

  getupdateStatMinute() {
    return this.minutesUpdatesBehaviorSubject.asObservable();
  }

  resetSignalKData() {
    this.skData = [];
    this.selfUrn = 'self';
  }

  unsubscribePath(uuid, path) {
    let registerIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    if (registerIndex >= 0) {
      this.pathRegister.splice(registerIndex,1);
    }
  }

  subscribePath(uuid: string, path: string, source: string) {
    // see if already subscribed, if yes return that...
    let registerIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    if (registerIndex >= 0) { // exists
      return this.pathRegister[registerIndex].subject.asObservable();
    }

    // find if we already have a value for this path to return.
    let currentValue = null;
    let state = IZoneState.normal;
    let pathIndex = this.skData.findIndex(pathObject => pathObject.path == path);
    if (pathIndex >= 0) { // exists
      if (source == 'default') {
        currentValue = this.skData[pathIndex].pathValue;
      } else if (source in this.skData[pathIndex].sources) {
        currentValue = this.skData[pathIndex].sources[source].sourceValue;
      } else {
        currentValue = this.skData[pathIndex]; //  return the entire pathObject
      }
      state = this.skData[pathIndex].state;
    }

    let newRegister: pathRegistration  = {
      uuid: uuid,
      path: path,
      source: source,
      subject: new BehaviorSubject<pathRegistrationValue>({ value: currentValue, state: state })
    };

    // Add to register array
    this.pathRegister.push(newRegister);
    // rxjs Subject should be created now. We use search now as maybe someone else adds something and it's no longer last in array :P
    pathIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    // Create Subject observable and and return
    return this.pathRegister[pathIndex].subject.asObservable();
  }

  private setSelfUrn(value: string) {
    if ((value != "" || value != null) && value != this.selfUrn) {
      console.debug('[SignalK Service] Setting self to: ' + value);
      this.selfUrn = value;
    }
  }

  private updatePathData(dataPath: IPathValueData): void {
    this.updateStatistics.currentSecond++; // update connection msg stats
    let updatePath = this.setPathContext(dataPath.context, dataPath.path);

    // position data is sent as degrees. KIP expects everything to be in SI, so rad.
    if (updatePath.includes('position.latitude') || updatePath.includes('position.longitude')) {
      dataPath.value = this.degToRad(dataPath.value);
    }

    // See if path key exists
    let pathIndex = this.skData.findIndex(pathObject => pathObject.path == updatePath);
    if (pathIndex >= 0) { // exists

      if (this.skData[pathIndex].defaultSource == null) { // null means the path was first created to a Meta update. Meta updates don't contain source information so we set default source on first source data update.
        this.skData[pathIndex].defaultSource = dataPath.source;
      }
      if (this.skData[pathIndex].type == null) { // null means the path was first created to a Meta update. Meta updates don't contain source information so we set default source on first source data update.
        this.skData[pathIndex].type = typeof(dataPath.value);

        // set path data type to accommodate for SK datetype
        if (typeof(dataPath.value) == "string") {
          if (isRfc3339StringDate(dataPath.value)) {
            this.skData[pathIndex].type = "Date";
          }
        }
      }
      this.skData[pathIndex].pathValue = dataPath.value; // we always push to both pat and source values
      this.skData[pathIndex].sources[dataPath.source] = {
        timestamp: dataPath.timestamp,
        sourceValue: dataPath.value,
      };

    } else { // doesn't exist. update...
      let pathType: string = typeof(dataPath.value);

      // set path data type to accommodate for SK datetype
      if (typeof(dataPath.value) == "string") {
        if (isRfc3339StringDate(dataPath.value)) {
          pathType = "Date";
        }
      }

      this.skData.push({
        path: updatePath,
        pathValue: dataPath.value,
        defaultSource: dataPath.source,
        type: pathType,
        state: IZoneState.normal,
        sources: {
          [dataPath.source]: {
            timestamp: dataPath.timestamp,
            sourceValue: dataPath.value
          }
        }
      });
      // get new object index for further processing
      pathIndex = this.skData.findIndex(pathObject => pathObject.path == updatePath);
    }

    // Check for any zones to set state
    let state: IZoneState = IZoneState.normal;
    this.zones.forEach(zone => {
      if (zone.path != updatePath) { return; }
      let lower = zone.lower || -Infinity;
      let upper = zone.upper || Infinity;
      let convertedValue = this.unitService.convertUnit(zone.unit, dataPath.value);
      if (convertedValue >= lower && convertedValue <= upper) {
        //in zone
        state = Math.max(state, zone.state);
      }
    });
    // if we're not in alarm, and new state is alarm, sound the alarm!
    // @ts-ignore
    if (state != IZoneState.normal && state != this.skData[pathIndex].state) {
      let stateString; // notification service needs string....
      let methods;
      switch (state) {
        // @ts-ignore
        case IZoneState.alarm:
          stateString = "alarm"
          methods = [ 'visual', 'sound' ];
          break;

        // @ts-ignore
        case IZoneState.warning:
            stateString = "warn"
            methods = [ 'visual','sound' ];
            break;

      }


      //start
      this.notificationsService.addAlarm(updatePath, {
        method: methods,
        state: stateString,
        message: updatePath + ' value in ' + stateString,
        timestamp: Date.now().toString(),
      })
    }

    // if we're in alarm, and new state is not alarm, stop the alarm
    // @ts-ignore
    if (this.skData[pathIndex].state != IZoneState.normal && state == IZoneState.normal) {
      this.notificationsService.deleteAlarm(updatePath);
    }

    this.skData[pathIndex].state = state;

    // push it to any subscriptions of that data
    this.pathRegister.filter(pathRegister => pathRegister.path == updatePath).forEach(
      pathRegister => {
        /**
         * Source of value 'default' is use to support SK path Priority feature by taking the pathValue
         * rather than the direct sourceValue. With Priority configured source can change over time
         * based on priority.
         *
         * Source of value of 'default' should only be selectable in the Widget Options -> Paths -> Data Source
         * UI control if only one source exists. Having a single source or using 'default' has no impact as
         * as pathValue is always taken.
         *
         * If multiple sources are present, either Priorities have not been properly configured, or the
         * user does not want Priorities for the path. In this case individual sources must be selected
         * and 'default' should not be visible.
         */
        if (pathRegister.source == 'default') {
          pathRegister.subject.next({
            value: this.skData[pathIndex].pathValue,
            state: this.skData[pathIndex].state
          });
        } else if (pathRegister.source in this.skData[pathIndex].sources) {
          pathRegister.subject.next({
            value: this.skData[pathIndex].sources[pathRegister.source].sourceValue,
            state: this.skData[pathIndex].state
          });
        } else {
          //we're looking for a source we don't know of... do nothing I guess?
          console.warn(`Failed updating zone state. Source unknown or not defined for path: ${pathRegister.source}`);
        }
      }
    );

    // push it to paths observer
    this.skDataObservable.next(this.skData);
  }

  private setMeta(meta: IMeta): void {
    let metaPath = this.setPathContext(meta.context, meta.path);
    let pathIndex = this.skData.findIndex(pathObject => pathObject.path == metaPath);
    if (pathIndex >= 0) {
      this.skData[pathIndex].meta = meta.meta;
    } else { // not in our list yet. The Meta update came before the Source update.
      this.skData.push({
        path: metaPath,
        pathValue: null,
        defaultSource: null,
        sources: {},
        meta: meta.meta,
        type: null,
        state: IZoneState.normal
      });
    }
  }

  private setPathContext(context: string, path: string): string {
    let finalPath: string = `${SELFROOTDEF}.${path}`;
    if (context !== this.selfUrn) { // account for external context data (coming from AIS, etc.)
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
  getPathsByType(valueType: string, selfOnly?: boolean): string[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let paths: string[] = [];
    for (let i = 0; i < this.skData.length;  i++) {
       if (this.skData[i].type == valueType) {
         if (selfOnly) {
          if (this.skData[i].path.startsWith("self")) {
            paths.push(this.skData[i].path);
          }
         } else {
          paths.push(this.skData[i].path);
         }
      }
    }
    return paths; // copy it....
  }

  getSkDataObservable(): Observable<IPathData[]> {
    return this.skDataObservable.asObservable();
  }

  getPathsAndMetaByType(valueType: string, selfOnly?: boolean): IPathMetaData[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let pathsMeta: IPathMetaData[] = [];
    for (let i = 0; i < this.skData.length;  i++) {
       if (this.skData[i].type == valueType) {
         if (selfOnly) {
          if (this.skData[i].path.startsWith("self")) {
            let p:IPathMetaData = {
              path: this.skData[i].path,
              meta: this.skData[i].meta,
            };
            pathsMeta.push(p);
          }
         } else {
          let p:IPathMetaData = {
            path: this.skData[i].path,
            meta: this.skData[i].meta,
          };
          pathsMeta.push(p);
         }
      }
    }
    return pathsMeta; // copy it....
  }

  getPathObject(path): IPathData {
    let pathIndex = this.skData.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    let foundPathObject: IPathData = cloneDeep(this.skData[pathIndex]);
    return foundPathObject;

  }

  getPathUnitType(path: string): string {
    let pathIndex = this.skData.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    if (('meta' in this.skData[pathIndex]) && ('units' in this.skData[pathIndex].meta)) {
      return this.skData[pathIndex].meta.units;
    } else {
      return null;
    }
  }

  public timeoutPathObservable(path: string, pathType: string): void {
    // push it to any subscriptions of that data
    this.pathRegister.filter(pathRegister => pathRegister.path == path).forEach(
      pathRegister => {

        let timeoutValue: pathRegistrationValue;

        switch (pathType) {
          case 'string':
              timeoutValue = {value: null, state: 0}
            break;

          case 'Date':
              timeoutValue = {value: null, state: 0}
            break;

          case 'boolean':
              // do nothing
            break;

          case 'number':
            timeoutValue = {value: null, state: 0}
            break;

          default:
            break;
        }

        pathRegister.subject.next(timeoutValue);
      }
    )
  }

  /**
   * Obtain a list of possible Kip value type conversions for a given path. ie,.: Speed conversion group
   * (kph, Knots, etc.). The conversion list will be trimmed to only the conversions for the group in question.
   * If a default value type (provided by server) for a path cannot be found,
   * the full list is returned and with 'unitless' as the default. Same goes if the value type exists,
   * but Kip does not handle it...yet.
   *
   * @param path The Signal K path of the value
   * @return conversions Full list array or subset of list array
   */
  getConversionsForPath(path: string): { default: string, conversions: IUnitGroup[] } {
    let pathUnitType = this.getPathUnitType(path);
    let groupList = [];
    let isUnitInList: boolean = false;
    let defaultUnit: string = "unitless"
    // if this Path has no predefined Unit type (from Meta or elsewhere) set to unitless
    if (pathUnitType === null) {
      return { default: 'unitless', conversions: this.conversionList };
    } else {
      // if this Widget has a configured Unit for this Path, only return all Units within same group.
      // The Assumption is that we should only use conversions group rules.
      for (let index = 0; index < this.conversionList.length; index++) {
        const unitGroup:IUnitGroup = this.conversionList[index];

         // add position group if position path
         if (unitGroup.group == 'Position' && (path.includes('position.latitude') || path.includes('position.longitude'))) {
          groupList.push(unitGroup)
        }

        unitGroup.units.forEach(unit => {
          if (unit.measure == pathUnitType) {
            isUnitInList = true;
            defaultUnit = this.defaultUnits[unitGroup.group];
            groupList.push(unitGroup);
          }
        });
      }
    }

    if (isUnitInList) {

      return { default: defaultUnit, conversions: groupList };
    }
    // default if we have a unit for the Path but it's not know by Kip
    console.log("Unit type: " + pathUnitType + ", found for path: " + path + "\nbut Kip does not support it.");
    return { default: 'unitless', conversions: this.conversionList };
  }

}
