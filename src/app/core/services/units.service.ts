import { DataService } from './data.service';
import { Injectable, OnDestroy } from '@angular/core';
import Qty from 'js-quantities';

import { AppSettingsService } from './app-settings.service';
import { Subscription } from 'rxjs';

export type TValidSkUnits = 's' | 'Hz' | 'm3' | 'm3/s' | 'kg/s' | 'kg/m3' | 'deg' | 'rad' | 'rad/s' | 'A' | 'C' | 'V' | 'W' | 'Nm' | 'J' | 'ohm' | 'm' | 'm/s' | 'm2' | 'K' | 'Pa' | 'kg' | 'ratio' | 'm/s2' | 'rad/s2' | 'N' | 'T' | 'Lux' | 'Pa/s' | 'Pa.s' | 'unitless' | null;

/**
 * Interface for a list of possible Kip value type conversions for a given path.
 *
 * @export
 * @interface IConversionPathList
 */
export interface IConversionPathList {
  default: string;
  conversions: IUnitGroup[];
}
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

/**
 * Interface for supported path value units provided by Signal K (schema v 1.7)
 * See: https://github.com/SignalK/specification/blob/master/schemas/definitions.json
 */
export interface ISkBaseUnit {
  unit: TValidSkUnits;
  properties: ISkUnitProperties;
}

/**
 * Interface describing units properties
 */
export interface ISkUnitProperties {
  display: string,
  quantity: string,
  quantityDisplay: string,
  description: string
}

@Injectable()

export class UnitsService implements OnDestroy {
  private _defaultUnitsSub: Subscription;

  /**
   * Definition of available Kip units to be used for conversion.
   * Measure property has to match one Unit Conversion Function for proper operation.
   * Description is human readable property.
   */
  private readonly _conversionList: IUnitGroup[] = [
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
      { measure: 'l/min', description: "Liters per minute"},
      { measure: 'l/h', description: "Liters per hour"},
      { measure: 'g/min', description: "Gallons per minute"},
      { measure: 'g/h', description: "Gallons per hour"}
    ] },
    { group: 'Temperature', units: [
      { measure: 'K', description: "Kelvin (default)"},
      { measure: 'celsius', description: "Celsius"},
      { measure: 'fahrenheit', description: "Fahrenheit"}
     ] },
    { group: 'Length', units: [
      { measure: 'm', description: "Meters (default)"},
      { measure: 'fathom', description: "Fathoms"},
      { measure: 'feet', description: "Feet"},
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
      { measure: 'kWh', description: "Kilowatt*Hours"},
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
      { measure: 'KHz', description: "KHz - Kilohertz" },
      { measure: 'MHz', description: "MHz - Megahertz" },
      { measure: 'GHz', description: "GHz - Gigahertz" },
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

  public readonly skBaseUnits: ISkBaseUnit[] =
    [
      { unit: "s", properties: {
          display: "s",
          quantity: "Time",
          quantityDisplay: "t",
          description: "Elapsed time (interval) in seconds"
        }
      },
      { unit: "Hz", properties: {
          display: "Hz",
          quantity: "Frequency",
          quantityDisplay: "f",
          description: "Frequency in Hertz"
        }
      },
      { unit: "m3", properties: {
          display: "m\u00b3",
          quantity: "Volume",
          quantityDisplay: "V",
          description: "Volume in cubic meters"
        }
      },
      { unit: "m3/s", properties: {
          display: "m\u00b3/s",
          quantity: "Flow",
          quantityDisplay: "Q",
          description: "Liquid or gas flow in cubic meters per second"
        }
      },
      { unit: "kg/s", properties: {
          display: "kg/s",
          quantity: "Mass flow rate",
          quantityDisplay: "\u1e41",
          description: "Liquid or gas flow in kilograms per second"
        }
      },
      { unit: "kg/m3", properties: {
          display: "kg/m\u00b3",
          quantity: "Density",
          quantityDisplay: "\u03c1",
          description: "Density in kg per cubic meter"
        }
      },
      { unit: "deg", properties: {
          display: "\u00b0",
          quantity: "Angle",
          quantityDisplay: "\u2220",
          description: "Latitude or longitude in decimal degrees"
        }
      },
      { unit: "rad", properties: {
          display: "\u33ad",
          quantity: "Angle",
          quantityDisplay: "\u2220",
          description: "Angular arc in radians"
        }
      },
      { unit: "rad/s", properties: {
          display: "\u33ad/s",
          quantity: "Rotation",
          quantityDisplay: "\u03c9",
          description: "Angular rate in radians per second"
        }
      },
      { unit: "A", properties: {
          display: "A",
          quantity: "Current",
          quantityDisplay: "I",
          description: "Electrical current in ampere"
        }
      },
      { unit: "C", properties: {
          display: "C",
          quantity: "Charge",
          quantityDisplay: "Q",
          description: "Electrical charge in Coulomb"
        }
      },
      { unit: "V", properties: {
          display: "V",
          quantity: "Voltage",
          quantityDisplay: "V",
          description: "Electrical potential in volt"
        }
      },
      { unit: "W", properties: {
          display: "W",
          quantity: "Power",
          quantityDisplay: "P",
          description: "Power in watt"
        }
      },
      { unit: "Nm", properties: {
          display: "Nm",
          quantity: "Torque",
          quantityDisplay: "\u03c4",
          description: "Torque in Newton meter"
        }
      },
      { unit: "J", properties: {
          display: "J",
          quantity: "Energy",
          quantityDisplay: "E",
          description: "Electrical energy in joule"
        }
      },
      { unit: "ohm", properties: {
          display: "\u2126",
          quantity: "Resistance",
          quantityDisplay: "R",
          description: "Electrical resistance in ohm"
        }
      },
      { unit: "m", properties: {
          display: "m",
          quantity: "Distance",
          quantityDisplay: "d",
          description: "Distance in meters"
        }
      },
      { unit: "m/s", properties: {
          display: "m/s",
          quantity: "Speed",
          quantityDisplay: "v",
          description: "Speed in meters per second"
        }
      },
      { unit: "m2", properties: {
          display: "\u33a1",
          quantity: "Area",
          quantityDisplay: "A",
          description: "(Surface) area in square meters"
        }
      },
      { unit: "K", properties: {
          display: "K",
          quantity: "Temperature",
          quantityDisplay: "T",
          description: "Temperature in kelvin"
        }
      },
      { unit: "Pa", properties: {
          display: "Pa",
          quantity: "Pressure",
          quantityDisplay: "P",
          description: "Pressure in pascal"
        }
      },
      { unit: "kg", properties: {
          display: "kg",
          quantity: "Mass",
          quantityDisplay: "m",
          description: "Mass in kilogram"
        }
      },
      { unit: "ratio", properties: {
          display: "",
          quantity: "Ratio",
          quantityDisplay: "\u03c6",
          description: "Relative value compared to reference or normal value. 0 = 0%, 1 = 100%, 1e-3 = 1 ppt"
        }
      },
      { unit: "m/s2", properties: {
          display: "m/s\u00b2",
          quantity: "Acceleration",
          quantityDisplay: "a",
          description: "Acceleration in meters per second squared"
        }
      },
      { unit: "rad/s2", properties: {
          display: "rad/s\u00b2",
          quantity: "Angular acceleration",
          quantityDisplay: "a",
          description: "Angular acceleration in radians per second squared"
        }
      },
      { unit: "N", properties: {
          display: "N",
          quantity: "Force",
          quantityDisplay: "F",
          description: "Force in newton"
        }
      },
      { unit: "T", properties: {
          display: "T",
          quantity: "Magnetic field",
          quantityDisplay: "B",
          description: "Magnetic field strength in tesla"
        }
      },
      { unit: "Lux", properties: {
          display: "lx",
          quantity: "Light Intensity",
          quantityDisplay: "Ev",
          description: "Light Intensity in lux"
        }
      },
      { unit: "Pa/s", properties: {
          display: "Pa/s",
          quantity: "Pressure rate",
          quantityDisplay: "R",
          description: "Pressure change rate in pascal per second"
        }
      },
      { unit: "Pa.s", properties: {
          display: "Pa s",
          quantity: "Viscosity",
          quantityDisplay: "\u03bc",
          description: "Viscosity in pascal seconds"
        }
      }
    ];

  private _defaultUnits: IUnitDefaults = null;

  constructor(
    private AppSettingsService: AppSettingsService,
    private data: DataService
    ) {
      this._defaultUnitsSub = this.AppSettingsService.getDefaultUnitsAsO().subscribe(
        appSettings => {
          this._defaultUnits = appSettings;
        }
      );
  }

  private unitConversionFunctions = {
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

      let h = Math.floor(v / 3600);
      let m = Math.floor(v % 3600 / 60);
      let s = Math.floor(v % 3600 % 60);
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
        if (s == 'S') { r = r * -1 }
        return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
      },
    'latitudeSec': function(v) {
      v = Qty(v, 'rad').to('deg').scalar ;
      let degree = Math.trunc(v);
      let s = 'N';
      if (v < 0) { s = 'S'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      if (s == 'S') { r = r * -1 }
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
      if (s == 'W') { r = r * -1 }
      return degree + '° ' + r.toFixed(2).padStart(5, '0') + '\' ' + s;
    },
    'longitudeSec': function(v) {
      v = Qty(v, 'rad').to('deg').scalar ;
      let degree = Math.trunc(v);
      let s = 'E';
      if (v < 0) { s = 'W'; degree = degree * -1 }
      let r = (v % 1) * 60; // decimal part of input, * 60 to get minutes
      if (s == 'W') { r = r * -1 }
      let minutes = Math.trunc(r);
      let seconds = (r % 1) * 60;

      return degree + '° ' + minutes + '\' ' + seconds.toFixed(2).padStart(5, '0') + '" ' + s;
    },
  }

  /**
   * Converts any number to the specified unit. The function does not validate if
   * source and destination units are compatible, ie. kph to degrees will be converted
   * but will return meaningless results.
   *
   * If the unit is not know, or or the value is null, Null will be returned.
   *
   * @param {string} unit The conversion type unit
   * @param {number} value The source value
   * @return {*}  {number} The result of the conversion
   * @memberof UnitsService
   */
  public convertToUnit(unit: string, value: number): number {
    if (!(unit in this.unitConversionFunctions)) { return null; }
    if (value === null) { return null; }
    let num: number = +value; // sometime we get strings here. Weird! Lazy patch.
    return this.unitConversionFunctions[unit](num);
  }

  /**
   * Returns the list KIP default unit conversion settings applied before presentation.
   * See KIP's Units Settings configuration.
   *
   * Ex: If a Signal K path's meta Units is set to 'm/s', could KIP automatically
   * convert to say, 'knots' before presentation. Received Signal K data is always
   * kept in native format.
   *
   * @return {*}  {IUnitDefaults}
   * @memberof UnitsService
   */
  public getDefaults(): IUnitDefaults {
    return this._defaultUnits;
  }

  /**
   * Return the list of possible conversions matrix by unit groups. Useful
   * to present possible conversion or select a conversation units that are
   * related.
   *
   * @return {*}  {IUnitGroup[]} an array of units by groups
   * @memberof UnitsService
   */
  public getConversions(): IUnitGroup[] {
    return this._conversionList;
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
  public getConversionsForPath(path: string): IConversionPathList {
    const pathUnitType = this.data.getPathUnitType(path);
    const UNITLESS = 'unitless';
    let defaultUnit: string = "unitless";

    if (pathUnitType === null) {
      return { default: UNITLESS, conversions: this._conversionList };
    } else {
      const groupList = this._conversionList.filter(unitGroup => {
        if (unitGroup.group == 'Position' && (path.includes('position.latitude') || path.includes('position.longitude'))) {
          return true;
        }

        const unitExists = unitGroup.units.find(unit => unit.measure == pathUnitType);
        if (unitExists) {
          defaultUnit = this._defaultUnits[unitGroup.group];
          return true;
        }

        return false;
      });

      if (groupList.length > 0) {
        return { default: defaultUnit, conversions: groupList };
      }

      console.log("[Units Service] Unit type: " + pathUnitType + ", found for path: " + path + "\nbut Kip does not support it.");
      return { default: UNITLESS, conversions: this._conversionList };
    }
  }

  ngOnDestroy(): void {
    this._defaultUnitsSub?.unsubscribe();
  }
}
