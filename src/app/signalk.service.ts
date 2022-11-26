import { Injectable } from '@angular/core';
import { Observable , BehaviorSubject, Subscription } from 'rxjs';
import { IPathData, IPathValueData, IPathMetaData, IDefaultSource, IMeta } from "./app-interfaces";
import { IZone, IZoneState } from './app-settings.interfaces';
import { AppSettingsService } from './app-settings.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { UnitsService, IUnitDefaults, IUnitGroup } from './units.service';
import { NotificationsService } from './notifications.service';
import * as Qty from 'js-quantities';

interface pathRegistrationValue {
  value: any;
  state: IZoneState;
};

interface pathRegistration {
  uuid: string;
  path: string;
  source: string; // if this is set, updates to observable are the direct value of this source...
  observable: BehaviorSubject<pathRegistrationValue>;
}

export interface updateStatistics {
  currentSecond: number; // number up updates in the last second
  secondsUpdates: number[]; // number of updates receieved for each of the last 60 seconds
  minutesUpdates: number[]; // number of updates receieved for each of the last 60 minutes

}

@Injectable({
  providedIn: 'root'
})
export class SignalKService {

  degToRad = Qty.swiftConverter('deg', 'rad');
  selfurn: string = 'self'; // self urn, should get updated on first delta or rest call.

  // Local array of paths containing received SignalK Data and used to source Observers
  paths: IPathData[] = [];
  // List of paths used by Kip (Widgets or App (Notifications and such))
  pathRegister: pathRegistration[] = [];

  // path Observable
  pathsObservale: BehaviorSubject<IPathData[]> = new BehaviorSubject<IPathData[]>([]);

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
    this.paths = [];
    this.selfurn = 'self';
  }

  unsubscribePath(uuid, path) {
    let registerIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    if (registerIndex >= 0) {
      this.pathRegister.splice(registerIndex,1);
    }
  }

  subscribePath(uuid: string, path: string, source: string) {
    //see if already subscribed, if yes return that...
    let registerIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    if (registerIndex >= 0) { // exists
      return this.pathRegister[registerIndex].observable.asObservable();
    }

    //find if we already have a value for this path to return.
    let currentValue = null;
    let state = IZoneState.normal;
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex >= 0) { // exists
      if (source === null) {
        currentValue = this.paths[pathIndex]; //  return the entire pathObject
      } else if (source == 'default') {
        currentValue = this.paths[pathIndex].sources[this.paths[pathIndex].defaultSource].value;
      } else if (source in this.paths[pathIndex].sources) {
        currentValue = this.paths[pathIndex].sources[source].value;
      }
      state = this.paths[pathIndex].state;
    }

    let newRegister = {
      uuid: uuid,
      path: path,
      source: source,
      observable: new BehaviorSubject<pathRegistrationValue>({ value: currentValue, state: state })
    };

    //register
    this.pathRegister.push(newRegister);
    // should be subscribed now, use search now as maybe someone else adds something and it's no longer last in array :P
    pathIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid == uuid));
    return this.pathRegister[pathIndex].observable.asObservable();
  }

  private setSelfUrn(value: string) {
    if ((value != "" || value != null) && value != this.selfurn) {
      console.debug('[SignalK Service] Setting self to: ' + value);
      this.selfurn = value;
    }
  }

  private updatePathData(dataPath: IPathValueData): void {
    // update connection msg stats
    this.updateStatistics.currentSecond++;

    // convert the selfURN to "self"
    let pathSelf: string = dataPath.path.replace(this.selfurn, 'self');

    // position data is sent as degrees. KIP expects everything to be in SI, so rad.
    if (pathSelf.includes('position.latitude') || pathSelf.includes('position.longitude')) {
      dataPath.value = this.degToRad(dataPath.value);
    }

    // See if path key exists
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) { // exists

      // Update data
      // null source path means, path was first created by metadata. Set source values
      if (this.paths[pathIndex].defaultSource === null) {
        this.paths[pathIndex].defaultSource = dataPath.source;
        this.paths[pathIndex].type = typeof(dataPath.value);
      }

      this.paths[pathIndex].sources[dataPath.source] = {
        timestamp: dataPath.timestamp,
        value: dataPath.value,
      };

    } else { // doesn't exist. update...
      this.paths.push({
        path: pathSelf,
        defaultSource: dataPath.source, // default source
        sources: {
          [dataPath.source]: {
            timestamp: dataPath.timestamp,
            value: dataPath.value
          }
        },
        type: typeof(dataPath.value),
        state: IZoneState.normal
      });
      // get new object index for further processing
      pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    }

    // Check for any zones to set state
    let state: IZoneState = IZoneState.normal;
    this.zones.forEach(zone => {
      if (zone.path != pathSelf) { return; }
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
    if (state != IZoneState.normal && state != this.paths[pathIndex].state) {
      let stateString; // notif service needs string....
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
      this.notificationsService.addAlarm(pathSelf, {
        method: methods,
        state: stateString,
        message: pathSelf + ' value in ' + stateString,
        timestamp: Date.now().toString(),
      })
    }

    // if we're in alarm, and new state is not alarm, stop the alarm
    // @ts-ignore
    if (this.paths[pathIndex].state != IZoneState.normal && state == IZoneState.normal) {
      this.notificationsService.deleteAlarm(pathSelf);
    }

    this.paths[pathIndex].state = state;

    // push it to any subscriptions of that data
    this.pathRegister.filter(pathRegister => pathRegister.path == pathSelf).forEach(
      pathRegister => {

        let source: string = null;
        if (pathRegister.source == 'default') {
          source = this.paths[pathIndex].defaultSource;
        } else if (pathRegister.source in this.paths[pathIndex].sources) {
          source = pathRegister.source;
        } else {
          //we're looking for a source we don't know of... do nothing I guess?
          console.warn(`Failed updating zone state. Source unknown or not defined for path: ${pathRegister.source}`);
        }
        if (source !== null) {
          pathRegister.observable.next({
            value: this.paths[pathIndex].sources[source].value,
            state: this.paths[pathIndex].state
          });
        }

      }
    );

    // push it to paths observer
    this.pathsObservale.next(this.paths);

  }

  private setDefaultSource(source: IDefaultSource): void {
    let pathSelf: string = source.path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) {
      this.paths[pathIndex].defaultSource = source.source;
    }
  }

  private setMeta(meta: IMeta): void {
    let pathSelf: string = meta.path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) {
      this.paths[pathIndex].meta = meta.meta;
    } else { // not in our list yet. Meta update can in first. Create the path with empty source values for later update
      this.paths.push({
        path: pathSelf,
        defaultSource: null,
        sources: {},
        meta: meta.meta,
        type: null,
        state: IZoneState.normal
      });
    }
  }

  /**
   * Returns a list of all known SignalK paths of the specified type (sting or numeric)
   * @param valueType data type: string or numeric
   * @param selfOnly if true, returns only paths the begins with "self". If false or not specified, everything known
   * @return array of signalK path string
   */
  getPathsByType(valueType: string, selfOnly?: boolean): string[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let paths: string[] = [];
    for (let i = 0; i < this.paths.length;  i++) {
       if (this.paths[i].type == valueType) {
         if (selfOnly) {
          if (this.paths[i].path.startsWith("self")) {
            paths.push(this.paths[i].path);
          }
         } else {
          paths.push(this.paths[i].path);
         }
      }
    }
    return paths; // copy it....
  }

  getPathsObservable(): Observable<IPathData[]> {
    return this.pathsObservale.asObservable();
  }

  getPathsAndMetaByType(valueType: string, selfOnly?: boolean): IPathMetaData[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let pathsMeta: IPathMetaData[] = [];
    for (let i = 0; i < this.paths.length;  i++) {
       if (this.paths[i].type == valueType) {
         if (selfOnly) {
          if (this.paths[i].path.startsWith("self")) {
            let p:IPathMetaData = {
              path: this.paths[i].path,
              meta: this.paths[i].meta,
            };
            pathsMeta.push(p);
          }
         } else {
          let p:IPathMetaData = {
            path: this.paths[i].path,
            meta: this.paths[i].meta,
          };
          pathsMeta.push(p);
         }
      }
    }
    return pathsMeta; // copy it....
  }

  getPathObject(path): IPathData {
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    let foundPathObject: IPathData = JSON.parse(JSON.stringify(this.paths[pathIndex])); // so we don't return the object reference and hamper garbage collection/leak memory
    return foundPathObject;

  }

  getPathUnitType(path: string): string {
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    if (('meta' in this.paths[pathIndex]) && ('units' in this.paths[pathIndex].meta)) {
      return this.paths[pathIndex].meta.units;
    } else {
      return null;
    }
  }

  /**
   * Obtain a list of possible Kip value type conversions for a given path. ie,.: Speed conversion group
   * (kph, Knots, etc.). The conversion list will be trimmed to only the conversions for the group in question.
   * If a default value type (provided by server) for a path cannot be found,
   * the full list is returned and with 'unitless' as the default. Same goes if the value type exists,
   * but Kip does not handle it...yet.
   *
   * @param path The SignalK path of the value
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
