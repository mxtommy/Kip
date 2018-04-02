import { Injectable } from '@angular/core';
import * as Qty from 'js-quantities';
import { SignalKService } from './signalk.service';


export interface IUnitInfo {
  group: string;
  units: string[];
}
interface IUnitDefaults {
  [key: string]: string;
}


@Injectable()

export class UnitsService {

  constructor(private SignalKService: SignalKService) {
//    console.log(Qty.getKinds());
//    console.log(Qty.getUnits());
//    console.log(Qty.getAliases('naut-mile'));
    //build list for others. 
   /* Object.keys(this.conversions).forEach(group => {
      this.conversionList[group] = [];
      Object.keys(this.conversions[group]).forEach(unit => {
        this.conversionList[group].push(unit);
      });
    }); */
  }

  defaultUnits: IUnitDefaults = {
    unitless: 'unitless',
    speed: 'knots',
    flow: 'liter/minute',
    temp: 'C',
    length: 'm',
    electrity: 'volts',
    pressure: 'mmHg',
    angularVelocity: 'rpm',
    angle: 'deg',
    ratio: '%'
  }

  conversionList: IUnitInfo[] = [
    { group: 'unitless', units: [ 'unitless' ] },
    { group: 'speed', units: [ 'knots','km/h', 'm/s' ] },
    { group: 'flow', units: ['m^3/s', 'liter/minute', 'liter/hour', 'gallon/minute', 'gallon/hour' ] },
    { group: 'temp', units: [ 'K', 'C', 'F' ] },
    { group: 'length', units: [ 'm', 'fathom', 'feet', 'km', 'nm', 'mile' ] },
    { group: 'electrity', units: [ 'amps', 'volts' ]},
    { group: 'pressure', units: [ 'pascal', 'hPa', 'bar', 'mbar', 'psi', 'mmHg' ] },
    { group: 'angularVelocity', units: [ 'rad/s', 'deg/s', 'deg/min', 'rpm' ] },
    { group: 'angle', units: [ 'rad', 'deg', 'grad' ] },
    { group: 'ratio', units: [ 'percent' ] },
  ];

  getConversionsForPath(path: string): { default: string, conversions: IUnitInfo[]} {
    let pathUnitType = this.SignalKService.getPathUnitType(path);
    if (pathUnitType === null) { return { default: 'unitless', conversions: this.conversionList }; } // if it's unknown units for this path let them choose from all 
    let group = this.conversionList.find(el => el.units.includes(pathUnitType)).group;
    let arr = this.conversionList.filter( el => el.group == group);
    if (arr.length > 0) {
      return { default: this.defaultUnits[group], conversions: arr};
    } else {
      return { default: 'unitless', conversions: this.conversionList };
    }
  }

}
