import { Injectable } from '@angular/core';
import * as Qty from 'js-quantities';

import { AppSettingsService } from './app-settings.service';
import { Subscription } from 'rxjs';

/**
 *  Group of Kip units array
 */
export interface IUnitGroup {
  group: string;
  units: IUnit[];
}[]

/**
 * Individual Kip units system measures definition
 */
export interface IUnit {
  measure: string;
  description: string;
}

/**
 * Interface for defaults Units per unit Groups to be applied
 */
export interface IUnitDefaults {
  [key: string]: string;
}

@Injectable()

export class UnitsService {



  defaultUnits: IUnitDefaults;
  defaultUnitsSub: Subscription;

  /**
   * Definition of available Kip units to be used for conversion.
   * Measure property has to match one Unit Conversion Function for proper operation.
   * Description is human readable property.
   */
  conversionList: IUnitGroup[] = [
    { group: 'Unitless', units: [
      { measure: 'unitless', description: "As-Is numeric value" }
    ] },
    { group: 'Speed', units: [
      { measure: 'knots', description: "Knots - Nautical miles per hour"},
      { measure: 'kph', description: "kph - Kilometers per hour"},
      { measure: 'mph', description: "mph - Miles per hour"},
      { measure: 'm/s', description: "m/s - Meters per second (default)"}
    ] },
    { group: 'Flow', units: [
      { measure: 'm3/s', description: "Cubic meters per second (default)"},
      { measure: 'l/min', description: "Litters per minute"},
      { measure: 'l/h', description: "Litters per hour"},
      { measure: 'g/min', description: "Gallons per minute"},
      { measure: 'g/h', description: "Gallons per hour"}
    ] },
    { group: 'Temperature', units: [
      { measure: 'K', description: "Kelvin (default)"},
      { measure: 'celsius', description: "Celsius"},
      { measure: 'fahrenheit', description: "Fahrenheit"}
     ] },
    { group: 'Length', units: [
      { measure: 'm', description: "Metres (default)"},
      { measure: 'fathom', description: "Fathoms"},
      { measure: 'feet', description: "Feets"},
      { measure: 'km', description: "Kilometers"},
      { measure: 'nm', description: "Nautical Miles"},
      { measure: 'mi', description: "Miles"},
    ] },
    { group: 'Volume', units: [
      { measure: 'liter', description: "Liters (default)"},
      { measure: 'm3', description: "Cubic Meters"},
      { measure: 'gallon', description: "Gallons"},
     ] },
    { group: 'Current', units: [
      { measure: 'A', description: "Amperes"},
      { measure: 'mA', description: "Milliamperes"}
    ] },
    { group: 'Potential', units: [
      { measure: 'V', description: "Volts"},
      { measure: 'mV', description: "Millivolts"}
    ] },
    { group: 'Charge', units: [
      { measure: 'C', description: "Coulomb"},
      { measure: 'Ah', description: "Ampere*Hours"},
    ] },
    { group: 'Power', units: [
      { measure: 'W', description: "Watts"},
      { measure: 'mW', description: "Milliwatts"},
    ] },
    { group: 'Energy', units: [
      { measure: 'J', description: "Joules"},
      { measure: 'kWh', description: "Kilo-Watt*Hours"},
    ] },
    { group: 'Pressure', units: [
      { measure: 'Pa', description: "Pascal (default)" },
      { measure: 'bar', description: "Bars" },
      { measure: 'psi', description: "psi" },
      { measure: 'mmHg', description: "mmHg" },
      { measure: 'inHg', description: "inHg" },
      { measure: 'hPa', description: "hPa" },
      { measure: 'mbar', description: "mbar" },
    ] },
    { group: 'Density', units: [ { measure: 'kg/m3', description: "Air density - kg/cubic meter"} ] },
    { group: 'Time', units: [
      { measure: 's', description: "Seconds (default)" },
      { measure: 'Minutes', description: "Minutes" },
      { measure: 'Hours', description: "Hours" },
      { measure: 'Days', description: "Days" },
      { measure: 'HH:MM:SS', description: "Hours:Minute:seconds"}
    ] },
    { group: 'Angular Velocity', units: [
      { measure: 'rad/s', description: "Radians per second" },
      { measure: 'deg/s', description: "Degrees per second" },
      { measure: 'deg/min', description: "Degrees per minute" },
    ] },
    { group: 'Angle', units: [
      { measure: 'rad', description: "Radians" },
      { measure: 'deg', description: "Degrees" },
      { measure: 'grad', description: "Gradians" },
    ] },
    { group: 'Frequency', units: [
      { measure: 'rpm', description: "RPM - Rotations per minute" },
      { measure: 'Hz', description: "Hz - Hertz (default)" },
      { measure: 'KHz', description: "KHz - KiloHertz" },
      { measure: 'MHz', description: "MHz - MegaHertz" },
      { measure: 'GHz', description: "GHz - GigaHertz" },
    ] },
    { group: 'Ratio', units: [
      { measure: 'percent', description: "As percentage value" },
      { measure: 'percentraw', description: "As ratio 0-1 with % sign" },
      { measure: 'ratio', description: "Ratio 0-1 (default)" }
    ] },
    { group: 'Position', units: [
      { measure: 'latitudeMin', description: "Latitude in minutes" },
      { measure: 'latitudeSec', description: "Latitude in seconds" },
      { measure: 'longitudeMin', description: "Longitude in minutes" },
      { measure: 'longitudeSec', description: "Longitude in seconds" },
    ] },
  ];


  constructor(  private AppSettingsService: AppSettingsService,
    ) {
      this.defaultUnitsSub = this.AppSettingsService.getDefaultUnitsAsO().subscribe(
        newDefaults => {
          this.defaultUnits = newDefaults;
        }
      );
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
    "mV": function(v) { return v*1000; },
//  Current
    "A": function(v) { return v; },
    "mA": function(v) { return v*1000; },
// charge
    "C": function(v) { return v; },
    "Ah": Qty.swiftConverter('C', 'Ah'),
// Power
    "W": function(v) { return v; },
    "mW": function(v) { return v*1000; },
// Energy
    "J": function(v) { return v; },
    "kWh": Qty.swiftConverter('J', 'kWh'),
//  pressure
    "Pa": function(v) { return v; },
    "bar": Qty.swiftConverter('Pa', 'bar'),
    "psi": Qty.swiftConverter('Pa', 'psi'),
    "mmHg": Qty.swiftConverter('Pa', 'mmHg'),
    "inHg": Qty.swiftConverter('Pa', 'inHg'),
    "hPa": Qty.swiftConverter('Pa', 'hPa'),
    "mbar": Qty.swiftConverter('Pa', 'millibar'),
// Density - Description: Current outside air density
    "kg/m3": function(v) { return v; },
//  Time
    "s": function(v) { return v; },
    "Minutes": Qty.swiftConverter('s', 'minutes'),
    "Hours": Qty.swiftConverter('s', 'hours'),
    "Days": Qty.swiftConverter('s', 'days'),
    "HH:MM:SS": function(v) {
      v = parseInt(v, 10);
      if (v < 0) { v = v *-1} // always positive

      var h = Math.floor(v / 3600);
      var m = Math.floor(v % 3600 / 60);
      var s = Math.floor(v % 3600 % 60);
      return ('0' + h).slice(-2) + ":" + ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2);
    },
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
    "grad": Qty.swiftConverter('rad', 'grad'),
//   ratio
    'percent': function(v) { return v * 100 },
    'percentraw': function(v) { return v },
    'ratio': function(v) { return v },
// lat/lon
    'latitudeMin': function(v) {
        v = Qty(v, 'rad').to('deg').scalar ;
        let degree = Math.trunc(v);
        let s = 'N';
        if (v < 0) { s = 'S'; degree = degree * -1 }
        let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
        return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
      },
    'latitudeSec': function(v) {
      v = Qty(v, 'rad').to('deg').scalar ;
      let degree = Math.trunc(v);
      let s = 'N';
      if (v < 0) { s = 'S'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      let minutes = Math.trunc(r);
      let seconds = (r % 1) * 60;

      return degree + '° ' + minutes + '\' ' + seconds.toFixed(2).padStart(5, '0') + '" ' + s;
    },
    'longitudeMin': function(v) {
      v = Qty(v, 'rad').to('deg').scalar ;
      let degree = Math.trunc(v);
      let s = 'E';
      if (v < 0) { s = 'W'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
    },
    'longitudeSec': function(v) {
      v = Qty(v, 'rad').to('deg').scalar ;
      let degree = Math.trunc(v);
      let s = 'E';
      if (v < 0) { s = 'W'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      let minutes = Math.trunc(r);
      let seconds = (r % 1) * 60;

      return degree + '° ' + minutes + '\' ' + seconds.toFixed(2).padStart(5, '0') + '" ' + s;
    },
  }



  convertUnit(unit: string, value: number): number {
    if (!(unit in this.unitConversionFunctions)) { return null; }
    if (value === null) { return null; }
    return this.unitConversionFunctions[unit](value);
  }

  getDefaults(): IUnitDefaults {
    return this.defaultUnits;
  }
  getConversions(): IUnitGroup[] {
    return this.conversionList;
  }

}
