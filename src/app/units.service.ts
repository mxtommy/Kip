import { Injectable } from '@angular/core';
import * as Qty from 'js-quantities';

import { AppSettingsService } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { Subscription } from 'rxjs';

export interface IUnitInfo {
  group: string;
  units: string[];
}
export interface IUnitDefaults {
  [key: string]: string;
}

@Injectable()

export class UnitsService {



  defaultUnits: IUnitDefaults;
  defaultUnitsSub: Subscription;

  conversionList: IUnitInfo[] = [
    { group: 'Unitless', units: [ 'unitless' ] },
    { group: 'Speed', units: [ 'knots','kph', 'mph', 'm/s' ] },
    { group: 'Flow', units: ['m3/s', 'l/min', 'l/h', 'g/min', 'g/h' ] },
    { group: 'Temperature', units: [ 'K', 'celsius', 'fahrenheit' ] },
    { group: 'Length', units: [ 'm', 'fathom', 'feet', 'km', 'nm', 'mi' ] },
    { group: 'Volume', units: [ 'liter', 'gallon', 'm3' ] },
    { group: 'Current', units: [ 'A' ] },
    { group: 'Potential', units: [ 'V' ] },
    { group: 'Charge', units: [ 'C' ] },
    { group: 'Power', units: [ 'W' ] },
    { group: 'Energy', units: [ 'J' ] },
    { group: 'Pressure', units: [ 'Pa', 'bar', 'psi', 'mmHg', 'inHg' ] },
    { group: 'Density', units: [ 'kg/m3' ] },
    { group: 'Time', units: [ 's', 'Minutes', 'Hours', 'Days' ] },
    { group: 'Angular Velocity', units: [ 'rad/s', 'deg/s', 'deg/min',  ] },
    { group: 'Angle', units: [ 'rad', 'deg', 'grad' ] },
    { group: 'Frequency', units: [ 'rpm', 'Hz', 'KHz', 'MHz', 'GHz' ] },
    { group: 'Ratio', units: [ 'ratio' ] },
    { group: 'Position', units: [ 'latitudeMin', 'latitudeSec', 'longitudeMin', 'longitudeSec' ] },
  ];


  constructor(  private AppSettingsService: AppSettingsService,
    private SignalKService: SignalKService) {
      this.defaultUnitsSub = this.AppSettingsService.getDefaultUnitsAsO().subscribe(
        newDefaults => {
          this.defaultUnits = newDefaults;
        }
      );
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


  unitConversionFunctions = {
    'unitless': function(v) { return v; },
//  speed
    'knots': Qty.swiftConverter("m/s", "kn"),
    'kph': Qty.swiftConverter("m/s", "kph"),
    'm/s': function(v) { return v; },
    'mph': Qty.swiftConverter("m/s", "mph"),
// volume
    "liter": Qty.swiftConverter('m^3', 'liter'),
    "gallon": Qty.swiftConverter('m^3', 'gallon'),
    "m3": function(v) { return v; },
//  flow
    'm3/s': function(v) { return v; },
    'l/min': Qty.swiftConverter("m^3/s", "liter/minute"),
    'l/h': Qty.swiftConverter("m^3/s", "liter/hour"),
    'g/min': Qty.swiftConverter("m^3/s", "gallon/minute"),
    'g/h': Qty.swiftConverter("m^3/s", "gallon/hour"),
//  temp
    "K": function(v) { return v; },
    "celsius": Qty.swiftConverter("tempK", "tempC"),
    "fahrenheit": Qty.swiftConverter("tempK", "tempF"),
//  length
    "m": function(v) { return v; },
    "fathom": Qty.swiftConverter('m', 'fathom'),
    "feet": Qty.swiftConverter('m', 'foot'),
    "km": Qty.swiftConverter('m', 'km'),
    "nm": Qty.swiftConverter('m', 'nmi'),
    "mi": Qty.swiftConverter('m', 'mi'),
//  Potential
    "V": function(v) { return v; },
//  Current
    "A": function(v) { return v; },
// charge
    "C": function(v) { return v; },
// Power
    "W": function(v) { return v; },
// Energy
    "J": function(v) { return v; },
//  pressure
    "Pa": function(v) { return v; },
    "bar": Qty.swiftConverter('Pa', 'bar'),
    "psi": Qty.swiftConverter('Pa', 'psi'),
    "mmHg": Qty.swiftConverter('Pa', 'mmHg'),
    "inHg": Qty.swiftConverter('Pa', 'inHg'),
// Density - Description: Current outside air density
    "kg/m3": function(v) { return v; },
//  Time
    "s": function(v) { return v; },
    "Minutes": Qty.swiftConverter('s', 'minutes'),
    "Hours": Qty.swiftConverter('s', 'hours'),
    "Days": Qty.swiftConverter('s', 'days'),
//  angularVelocity
    "rad/s": function(v) { return v; },
    "deg/s": Qty.swiftConverter('rad/s', 'deg/s'),
    "deg/min": Qty.swiftConverter('rad/s', 'deg/min'),
//  frequency
    "rpm": function(v) { return v*60; },
    "Hz": function(v) { return v; },
    "KHz": function(v) { return v/1000; },
    "MHz": function(v) { return v/1000000; },
    "GHz": function(v) { return v/1000000000; },
//  angle
    "rad": function(v) { return v; },
    "deg": Qty.swiftConverter('rad', 'deg'),
//   ratio
    'ratio': function(v) { return v * 100 },
// lat/lon
    'latitudeMin': function(v) {
        let degree = Math.trunc(v);
        let s = 'N';
        if (v < 0) { s = 'S'; degree = degree * -1 }
        let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
        return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
      },
    'latitudeSec': function(v) {
      let degree = Math.trunc(v);
      let s = 'N';
      if (v < 0) { s = 'S'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      let minutes = Math.trunc(r);
      let seconds = (r % 1) * 60;

      return degree + '° ' + minutes + '\' ' + seconds.toFixed(2).padStart(5, '0') + '" ' + s;
    },
    'longitudeMin': function(v) {
      let degree = Math.trunc(v);
      let s = 'E';
      if (v < 0) { s = 'W'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
    },
    'longitudeSec': function(v) {
      let degree = Math.trunc(v);
      let s = 'E';
      if (v < 0) { s = 'W'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      let minutes = Math.trunc(r);
      let seconds = (r % 1) * 60;

      return degree + '° ' + minutes + '\' ' + seconds.toFixed(2).padStart(5, '0') + '" ' + s;
    },
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

  getDefaults(): IUnitDefaults {
    return this.defaultUnits;
  }
  getConversions(): IUnitInfo[] {
    return this.conversionList;
  }

}
