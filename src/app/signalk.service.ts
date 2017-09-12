import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';


export enum SIUnits {
  'V',
  'm/s',
  'K'
}



export class pathObject {
  path: string;
  defaultSource: string; // default source
  sources: {
    [sourceName: string]: { // per source data
      timestamp: number;
      value: any;
    }
  }
  meta?: {
    label?: string;
    abbreviation?: string;
    units?: string;
    zones?: {
      state: string;
      lower?: number;
      upper?: number;
      message?: string;
    }[];
  }
  type: string;
}


interface pathRegistration {
  uuid: string;
  path: string;
  observable: BehaviorSubject<pathObject>;
}

export interface pathInfo {
  path: string;

}

@Injectable()
export class SignalKService {

  selfurn: string = 'self'; // self urn, should get updated on first delta or rest call.
  paths: pathObject[] = [];
  pathRegister: pathRegistration[] = [];

  constructor() { }

  resetSignalKData() {
    this.paths = [];
    this.pathRegister = [];
    this.selfurn = 'self';
  }
  

  subscribePath(uuid, path) {
    //see if already subscribed, if yes return that...
    let registerIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid = uuid));
    if (registerIndex >= 0) { // exists
      return this.pathRegister[registerIndex].observable.asObservable();
    }
    
    //find if we already have a value for this path to return.
    let currentValue: pathObject;
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex >= 0) { // exists
      currentValue = this.paths[pathIndex];
    } else {
      currentValue = null;
    }

    //register
    this.pathRegister.push({
      uuid: uuid,
      path: path,
      observable: new BehaviorSubject<pathObject>(currentValue)
    });
    // should be subscribed now, use search now as maybe someone else adds something and it's no longer last in array :P
    pathIndex = this.pathRegister.findIndex(registration => (registration.path == path) && (registration.uuid = uuid));
    return this.pathRegister[pathIndex].observable.asObservable();
  }


  setSelf(value: string) {
    console.debug('Setting self to: ' + value);
    this.selfurn = value;
  }
 


  updatePathData(path: string, source: string, timestamp: number, value: any) {
    // convert the selfURN to "self"
    let pathSelf: string = path.replace(this.selfurn, 'self');

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
        type: typeof(value)
      });
      pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    }

    
    // push it to any subscriptions of that data
    for (let i = 0; i < this.pathRegister.length;  i++) {
      if (this.pathRegister[i].path == pathSelf) {
        this.pathRegister[i].observable.next(this.paths[pathIndex]);
      }
    }
  }

  setDefaultSource(path: string, source: string) {
    let pathSelf: string = path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex > 0) {
      this.paths[pathIndex].defaultSource = source;
    }
  }

  setMeta(path: string, meta) {
    let pathSelf: string = path.replace(this.selfurn, 'self');
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == pathSelf);
    if (pathIndex > 0) {
      this.paths[pathIndex].meta = meta;
    }
  }


  getAllPathsNormal() {
    let paths: string[] = [];
    for (let i = 0; i < this.paths.length;  i++) {
      if ((this.paths[i].type == 'string') || (this.paths[i].type == 'number')) {
        paths.push(this.paths[i].path);
      }
    }
    return paths; // copy it....
  }

  getPathObject(path): pathObject {
    let pathIndex = this.paths.findIndex(pathObject => pathObject.path == path);
    if (pathIndex < 0) { return null; }
    return this.paths[pathIndex];

  }

}
