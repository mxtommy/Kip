import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

import { SignalKService, pathObject } from './signalk.service';
import { AppSettingsService } from './app-settings.service';


interface calculatorData {
  [path: string]: number;
}


const possibleDerivations = [
  {
    name: 'True Wind',
    requiredPaths: [ "vessels.self.navigation.headingTrue", "vessels.self.navigation.speedThroughWater", "vessels.self.environment.wind.speedApparent", "vessels.self.environment.wind.angleApparent" ],
    calculator: function(data: calculatorData) {


      var apparentX = Math.cos(data['vessels.self.environment.wind.angleApparent']) * data['vessels.self.environment.wind.speedApparent'];
      var apparentY = Math.sin(data['vessels.self.environment.wind.angleApparent']) * data['vessels.self.environment.wind.speedApparent'];
      var angle = Math.atan2(apparentY, -data['vessels.self.navigation.speedThroughWater'] + apparentX);
      var speedtrue = Math.sqrt(Math.pow(apparentY, 2) + Math.pow(-data['vessels.self.navigation.speedThroughWater'] + apparentX, 2));

      var dir = data['vessels.self.navigation.headingTrue'] + angle;

      if ( dir > Math.PI*2 ) {
        dir = dir - Math.PI*2;
      } else if ( dir < 0 ) {
        dir = dir + Math.PI*2;
      }

      let result: calculatorData = {
        "vessels.self.environment.wind.directionTrue": dir,
        "vessels.self.environment.wind.angleTrueWater": angle,
        "vessels.self.environment.wind.speedTrue": speedtrue
      }
      return result;
    }
  },
  {
    name: 'Dew Point',
    requiredPaths: [ "vessels.self.environment.outside.temperature", "vessels.self.environment.outside.humidity" ],
    calculator: function(data: calculatorData) {
      //Magnus formula:
      //var tempC = temp + 273.16
      const b = 18.678
      const c = 257.14
     // var magnus = Math.log(hum) + (b * tempC)/(c + tempC)
    //  var dewPoint = (c * magnus) / (b - magnus) - 273.16
    let result: calculatorData = {}
    return result;
      //return [{ path: "vessels.self.environment.outside.dewPointTemperature", value: dewPoint}]
    }
  }

];

export interface IDerivation {
  name: string;
  updateAny: boolean;
  paths: {
    path: string;
    source: string;
  }[]  
}
interface activeDerivation {
  name: string; //same name as 
  pathSubs: {
    path: string;
    value: number;
    subUUID: string; // usually it's a widget subbing...
    sub: Subscription; 
  }[],
  timerSub: Subscription;
}

@Injectable()
export class DerivedService {

  derivations: IDerivation[] = [];
  activeDerivations: activeDerivation[] = [];
  

  constructor(
    private AppSettingsService: AppSettingsService,
    private SignalKService: SignalKService,
  ) { 
    this.derivations = AppSettingsService.getDerivations();
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }

  startAllDerivations() {
    console.log("Starting " + this.derivations.length.toString() + " Derivations");
    for (let x=0; x< this.derivations.length; x++) {
      this.activateDerivation(this.derivations[x].name);
    }

  }

  getPossibleDerivations() {
    // return name/required paths;
    let result = [];
    for (let x=0; x < possibleDerivations.length; x++) {
      result.push({name: possibleDerivations[x].name, requiredPaths: possibleDerivations[x].requiredPaths, active: false});
    }
    return result;
  }

  addDerivation(newDerivation: IDerivation) {
    //check if already added, if yes just change sources
    let idx = this.derivations.findIndex(der => der.name == newDerivation.name);
    if (idx >=0) { 
      this.derivations[idx].paths = newDerivation.paths;
    } else {
      //new
      this.derivations.push(newDerivation);
    }
    this.activateDerivation(newDerivation.name);
    this.saveDerivations();
  }

  // TODO So many indexes.... :(
  activateDerivation(name: string)  {
    //check if already active. if yes unsub first
    if (this.activeDerivations.findIndex(der => der.name == name) >= 0) {
      this.deactivateDerivation(name);
    }
    let constIdx = possibleDerivations.findIndex(der => der.name == name)
    if (constIdx < 0) { return; }// uhhh?
    let derIdx = this.derivations.findIndex(der => der.name == name);
    if (derIdx < 0) { return; }//  uhhh>

    // build activeDerivation Object
    this.activeDerivations.push({name: name, pathSubs: [], timerSub: null});
    let actIdx = this.activeDerivations.findIndex(der => der.name == name);

    //sub to each path
    for (let x=0; x<this.derivations[derIdx].paths.length; x++) {
      let pathSubUUID = this.newUuid();
      this.activeDerivations[actIdx].pathSubs.push({path: this.derivations[derIdx].paths[x].path, subUUID: pathSubUUID, sub: null, value: null });
      let pathIdx = this.activeDerivations[actIdx].pathSubs.findIndex(p => p.path == this.derivations[derIdx].paths[x].path)
      this.activeDerivations[actIdx].pathSubs[pathIdx].sub = this.SignalKService.subscribePath(pathSubUUID, this.derivations[derIdx].paths[x].path).subscribe(
        pathObject => {
          if (pathObject === null) {
            return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
          }
          let source: string;
          if (this.derivations[derIdx].paths[x].source == 'default') {
            source = pathObject.defaultSource;
          } else {
            source = this.derivations[derIdx].paths[x].source;
          }
          if (pathObject.sources[source].value === null) {
            this.activeDerivations[actIdx].pathSubs[pathIdx].value = null;
            return;
          }
          let value:number = pathObject.sources[source].value;
          this.activeDerivations[actIdx].pathSubs[pathIdx].value = value;
          if (this.derivations[derIdx].updateAny) {
            this.calculateDerivation(name);
          }
        }
      );


    } // end for each path
    // if not updateAny, we need to set a timer to update it.
    this.activeDerivations[actIdx].timerSub = Observable.interval(1000).subscribe(
      tick => {
        this.calculateDerivation(name);
      }
    );

  }

  deactivateDerivation(name: string) {

  }

  calculateDerivation(name: string) {
    let constIdx = possibleDerivations.findIndex(der => der.name == name)
    if (constIdx < 0) { return; }// uhhh?
    
    // calucation functions requre array of objects path + value
    let actIdx = this.activeDerivations.findIndex(der => der.name == name);
    let data: calculatorData = {};
    for (let x=0; x< this.activeDerivations[actIdx].pathSubs.length; x++) {
      data[this.activeDerivations[actIdx].pathSubs[x].path] = this.activeDerivations[actIdx].pathSubs[x].value;
    }
    let result = possibleDerivations[constIdx].calculator(data);
    for (let path in result) {
      this.SignalKService.updatePathData(path, 'derived-in-app', Date.now(), result[path]);
    }
  }

  saveDerivations() {
    this.AppSettingsService.saveDerivations(this.derivations);
  }

}


