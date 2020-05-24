import { Injectable } from '@angular/core';
import * as Qty from 'js-quantities';
/* https://github.com/gentooboontoo/js-quantities/blob/master/src/quantities/definitions.js */



@Injectable()

export class UnitConvertService {

  constructor() {}

  conversions = {
    'discreet': {
      'no unit': function(v) { return v; }
    },
    'speed': {
      'knots': Qty.swiftConverter("m/s", "kn"),
      'km/h': Qty.swiftConverter("m/s", "km/h"),
      'm/s': function(v) { return v; }
    },
    'flow': {
      'm3/s': function(v) { return v; },
      'l/min': Qty.swiftConverter("m^3/s", "liter/minute"),
      'l/h': Qty.swiftConverter("m^3/s", "liter/hour"),
      'g/min': Qty.swiftConverter("m^3/s", "gallon/minute"),
      'g/h': Qty.swiftConverter("m^3/s", "gallon/hour")
    },
    'temp': {
      "K": function(v) { return v; },
      "C": Qty.swiftConverter("tempK", "tempC"),
      "F": Qty.swiftConverter("tempK", "tempF")
    },
    'distance': {
      "m": function(v) { return v; },
      "fathom": Qty.swiftConverter('m', 'fathom'),
      "feet": Qty.swiftConverter('m', 'foot'),
      "km": Qty.swiftConverter('m', 'km'),
      "nm": Qty.swiftConverter('m', 'nmi')
    },
    'volume': {
      "liter": Qty.swiftConverter('m^3', 'liter'),
      "gallon": Qty.swiftConverter('m^3', 'gallon'),
      "m3": function(v) { return v; },
    },
    'electrical': {
      "volts": function(v) { return v; },
      "amps": function(v) { return v; },
    },
    'pressure': {
      "pascal": function(v) { return v; },
      "hPa": Qty.swiftConverter('pascal', 'hPa'),
      "bar": Qty.swiftConverter('pascal', 'bar'),
      "mbar": Qty.swiftConverter('pascal', 'millibar'),
      "psi": Qty.swiftConverter('pascal', 'psi'),
      "mmHg": Qty.swiftConverter('pascal', 'mmHg')
    },
    'time': {
      "seconds": function(v) { return v; },
      "minutes": Qty.swiftConverter('s', 'minutes'),
      "hours": Qty.swiftConverter('s', 'hours'),
      "days": Qty.swiftConverter('s', 'days')
    },
    'angularVelocity': {
      "rad/s": function(v) { return v; },
      "deg/s": Qty.swiftConverter('rad/s', 'deg/s'),
      "deg/min": Qty.swiftConverter('rad/s', 'deg/min')
    },
    'angle': {
      "rad": function(v) { return v; },
      "deg": Qty.swiftConverter('rad', 'deg')
    },
    'ratio': {
      '%': function(v) { return v * 100 },
    }

  };

  getConverter() {
    return this.conversions;
  }


}
