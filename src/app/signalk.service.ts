import { Injectable } from '@angular/core';
import { Observable ,  Subject ,  BehaviorSubject, Subscription } from 'rxjs';
import { IPathObject, IPathAndMetaObjects } from "../app/signalk-interfaces";
import * as compareVersions from 'compare-versions';

import { AppSettingsService, IZone, ZoneState } from './app-settings.service';
import { UnitsService, IUnitDefaults, IUnitGroup } from './units.service';

import * as Qty from 'js-quantities';

interface pathRegistrationValue {
  value: any;
  state: ZoneState;
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

@Injectable()
export class SignalKService {

  degToRad = Qty.swiftConverter('deg', 'rad');

  serverSupportApplicationData: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false)
  serverVersion: BehaviorSubject<string> = new BehaviorSubject<string>(null) // version of the signalk server
  selfurn: string = 'self'; // self urn, should get updated on first delta or rest call.

  // Local array of paths containing received SignalK Data and used to source Observers
  paths: IPathObject[] = [];
  // List of paths used by Kip (Widgets or App (Notifications and such))
  pathRegister: pathRegistration[] = [];

  // path Observable
  pathsObservale: BehaviorSubject<IPathObject[]> = new BehaviorSubject<IPathObject[]>([]);

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
    private UnitService: UnitsService) { 
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
    this.conversionList = this.UnitService.getConversions();
    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(zones => {
      this.zones = zones;
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
    let state = ZoneState.normal;
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

  setSelf(value: string) {
    console.debug('Setting self to: ' + value);
    this.selfurn = value;
  }

  setServerVersion(version: string) {
    console.log("Server version:" + version);
    if (version) {
      this.serverSupportApplicationData.next(compareVersions.compare(version, '1.27.0', ">="));
    } else {
      this.serverSupportApplicationData.next(false);
    }
    this.serverVersion.next(version);
  }

  getServerVersionAsO() {
    return this.serverVersion.asObservable();
  }

  getServerSupportApplicationDataAsO() {
    return this.serverSupportApplicationData.asObservable();
  }

  updatePathData(path: string, source: string, timestamp: number, value: any) {
    this.updateStatistics.currentSecond++;
    // convert the selfURN to "self"
    let pathSelf: string = path.replace(this.selfurn, 'self');

    // position data is sent as degrees. KIP expects everything to be in SI, so rad.
    if (pathSelf.includes('position.latitude') || pathSelf.includes('position.longitude')) {
      value = this.degToRad(value);
    }

    // update existing if exists.
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) { // exists

      // update data
      this.paths[pathIndex].sources[source] = {
        timestamp: timestamp,
        value: value
      };

    } else { // doesn't exist. update...
      this.paths.push({
        path: pathSelf,
        defaultSource: source, // default source
        sources: {
          [source]: {
            timestamp: timestamp,
            value: value
          }
        },
        type: typeof(value),
        state: ZoneState.normal
      });
      pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    }

    // Check for any zones to set state
    let state: ZoneState = ZoneState.normal;
    this.zones.forEach(zone => {
      if (zone.path != pathSelf) { return; }
      let lower = zone.lower || -Infinity;
      let upper = zone.upper || Infinity;
      let convertedValue = this.UnitService.convertUnit(zone.unit, value);
      if (convertedValue >= lower && convertedValue <= upper) {
        //in zone
        state = Math.max(state, zone.state);
      }
    });
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

  setDefaultSource(path: string, source: string) {
    let pathSelf: string = path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) {
      this.paths[pathIndex].defaultSource = source;
    }
  }

  setMeta(path: string, meta) { //TODO(David): Look at Meta and maybe build Zones
    let pathSelf: string = path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex >= 0) {
      this.paths[pathIndex].meta = meta;
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

  getPathsObservable(): Observable<IPathObject[]> {
    return this.pathsObservale.asObservable();
  }

  getPathsAndMetaByType(valueType: string, selfOnly?: boolean): IPathAndMetaObjects[] { //TODO(David): See how we should handle string and boolean type value. We should probably return error and not search for it, plus remove from the Units UI.
    let pathsMeta: IPathAndMetaObjects[] = [];
    for (let i = 0; i < this.paths.length;  i++) {
       if (this.paths[i].type == valueType) {
         if (selfOnly) {
          if (this.paths[i].path.startsWith("self")) {
            let p:IPathAndMetaObjects = {
              path: this.paths[i].path,
              meta: this.paths[i].meta,
            };
            pathsMeta.push(p);
          }
         } else {
          let p:IPathAndMetaObjects = {
            path: this.paths[i].path,
            meta: this.paths[i].meta,
          };
          pathsMeta.push(p);
         }
      }
    }
    return pathsMeta; // copy it....
  }

  getPathObject(path): IPathObject {
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    let foundPathObject: IPathObject = JSON.parse(JSON.stringify(this.paths[pathIndex])); // so we don't return the object reference and hamper garbage collection/leak memory
    return foundPathObject;

  }

  getPathUnitType(path: string): string { //TODO(David): Look at Unit Path Type
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
