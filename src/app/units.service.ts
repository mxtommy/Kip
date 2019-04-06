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
    { group: 'speed', units: [ 'knots','kph', 'mph', 'm/s' ] },
    { group: 'flow', units: ['m3/s', 'l/min', 'l/h', 'g/min', 'g/h' ] },
    { group: 'temp', units: [ 'K', 'C', 'F' ] },
    { group: 'length', units: [ 'm', 'fathom', 'feet', 'km', 'nm', 'mi' ] },
    { group: 'electrity', units: [ 'amps', 'volts' ]},
    { group: 'pressure', units: [ 'pascal', 'hPa', 'bar', 'mbar', 'psi', 'mmHg', 'inHg' ] },
    { group: 'angularVelocity', units: [ 'rad/s', 'deg/s', 'deg/min',  ] },
    { group: 'angle', units: [ 'rad', 'deg', 'grad' ] },
    { group: 'frequency', units: [ 'rpm', 'Hz', 'KHz', 'MHz', 'GHz' ] },
    { group: 'ratio', units: [ 'percent' ] },
  ];

  unitConversionFunctions = {
    'unitless': function(v) { return v; },
//  speed      
    'knots': Qty.swiftConverter("m/s", "kn"),
    'kph': Qty.swiftConverter("m/s", "kph"),
    'm/s': Qty.swiftConverter("m/s", "m/s"),
    'mph': Qty.swiftConverter("m/s", "mph"),
//  flow      
    'm3/s': Qty.swiftConverter("m^3/s", "m^3/s"),
    'l/min': Qty.swiftConverter("m^3/s", "liter/minute"),
    'l/h': Qty.swiftConverter("m^3/s", "liter/hour"),
    'g/min': Qty.swiftConverter("m^3/s", "gallon/minute"),
    'g/h': Qty.swiftConverter("m^3/s", "gallon/hour"),
//  temp      
    "K": Qty.swiftConverter("tempK", "tempK"),
    "C": Qty.swiftConverter("tempK", "tempC"),
    "F": Qty.swiftConverter("tempK", "tempF"),
//  length      
    "m": Qty.swiftConverter('m', 'm'),
    "fathom": Qty.swiftConverter('m', 'fathom'),
    "feet": Qty.swiftConverter('m', 'foot'),
    "km": Qty.swiftConverter('m', 'km'),
    "nm": Qty.swiftConverter('m', 'nmi'),
    "mi": Qty.swiftConverter('m', 'mi'),
//  electrical      
    "volts": function(v) { return v; },
    "amps": function(v) { return v; },
//  presure      
    "pascal": Qty.swiftConverter('pascal', 'pascal'),
    "hPa": Qty.swiftConverter('pascal', 'hPa'),
    "bar": Qty.swiftConverter('pascal', 'bar'),
    "mbar": Qty.swiftConverter('pascal', 'millibar'),
    "psi": Qty.swiftConverter('pascal', 'psi'),
    "mmHg": Qty.swiftConverter('pascal', 'mmHg'),
    "inHg": Qty.swiftConverter('pascal', 'inHg'),
//  angularVelocity
    "rad/s": Qty.swiftConverter('rad/s', 'rad/s'),
    "deg/s": Qty.swiftConverter('rad/s', 'deg/s'),
    "deg/min": Qty.swiftConverter('rad/s', 'deg/min'),
//  frequency
    "rpm": function(v) { return v*60; },
    "Hz": function(v) { return v; },
    "KHz": function(v) { return v/1000; },
    "MHz": function(v) { return v/1000000; },
    "GHz": function(v) { return v/1000000000; }, 
//  angle
    "rad": Qty.swiftConverter('rad', 'rad'),
    "deg": Qty.swiftConverter('rad', 'deg'),
//   ratio
    '%': function(v) { return v * 100 },
  }



  getConversionsForPath(path: string): { default: string, conversions: IUnitInfo[]} {
    let pathUnitType = this.SignalKService.getPathUnitType(path);
    if (pathUnitType === null) { return { default: 'unitless', conversions: this.conversionList }; } // if it's unknown units for this path let them choose from all 
    let group = this.conversionList.find(el => el.units.includes(pathUnitType));
    if (group === undefined) { return { default: 'unitless', conversions: this.conversionList }; }
    let arr = this.conversionList.filter( el => el.group == group.group);
    if (arr.length > 0) {
      return { default: this.defaultUnits[group.group], conversions: arr};
    } else {
      return { default: 'unitless', conversions: this.conversionList };
    }
  }

  convertUnit(unit: string, value: number): number {
    if (!(unit in this.unitConversionFunctions)) { return null; }
    if (value === null) { return null; }
    return this.unitConversionFunctions[unit](value);
  }

}
