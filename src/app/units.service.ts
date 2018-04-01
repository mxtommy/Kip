import { Injectable } from '@angular/core';
import * as Qty from 'js-quantities';
import { SignalKService } from './signalk.service';


interface IUnitInfo {
  group: string;
  unit: string;
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
    flow: 'l/h',
    temp: 'C',
    length: 'nm',
    electrity: 'volts',
    pressure: 'mmHg',
    angularVelocity: 'rpm',
    angle: 'deg',
    ratio: '%'
  }

  conversionList: IUnitInfo[] = [
    { group: 'unitless', unit: 'unitless' },
    { group: 'speed', unit: 'knots' },
    { group: 'speed', unit: 'km/h' },
    { group: 'speed', unit: 'm/s' },
    { group: 'flow', unit: 'm^3/s' },
    { group: 'flow', unit: 'liter/minute' },
    { group: 'flow', unit: 'liter/hour' },
    { group: 'flow', unit: 'gallon/minute' },
    { group: 'flow', unit: 'gallon/hour' },
    { group: 'temp', unit: 'K' },
    { group: 'temp', unit: 'C' },
    { group: 'temp', unit: 'F' },
    { group: 'length', unit: 'meter' },
    { group: 'length', unit: 'fathom' },
    { group: 'length', unit: 'feet' },
    { group: 'length', unit: 'km' },
    { group: 'length', unit: 'nm' },
    { group: 'length', unit: 'mile' },
    { group: 'electrity', unit: 'amps' },
    { group: 'electrity', unit: 'volts' },
    { group: 'pressure', unit: 'pascal' },
    { group: 'pressure', unit: 'hPa' },
    { group: 'pressure', unit: 'bar' },
    { group: 'pressure', unit: 'mbar' },
    { group: 'pressure', unit: 'psi' },
    { group: 'pressure', unit: 'mmHg' },
    { group: 'angularVelocity', unit: 'rad/s' },
    { group: 'angularVelocity', unit: 'deg/s' },
    { group: 'angularVelocity', unit: 'deg/min' },
    { group: 'angularVelocity', unit: 'rpm' },
    { group: 'angle', unit: 'rad' },
    { group: 'angle', unit: 'deg' },
    { group: 'angle', unit: 'grad' },
    { group: 'ratio', unit: 'percent' },
  ];

  getConversionsForPath(path: string): { default: string, conversions: IUnitInfo[]} {
    let pathUnitType = this.SignalKService.getPathUnitType(path);
    if (pathUnitType === null) { return { default: 'unitless', conversions: this.conversionList }; } // if it's unknown units for this path let them choose from all 
    let group = this.conversionList.find(el => el.unit == pathUnitType ).group;
    let arr = this.conversionList.filter( el => el.group == group);
    if (arr.length > 0) {
      return { default: this.defaultUnits[group], conversions: arr};
    } else {
      return { default: 'unitless', conversions: this.conversionList };
    }
  }

}
