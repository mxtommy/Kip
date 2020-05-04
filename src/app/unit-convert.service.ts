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
      'm/s': Qty.swiftConverter("m/s", "m/s")
    },
    'flow': {
      'm3/s': Qty.swiftConverter("m^3/s", "m^3/s"),
      'l/min': Qty.swiftConverter("m^3/s", "liter/minute"),
      'l/h': Qty.swiftConverter("m^3/s", "liter/hour"),
      'g/min': Qty.swiftConverter("m^3/s", "gallon/minute"),
      'g/h': Qty.swiftConverter("m^3/s", "gallon/hour")
    },
    'temp': {
      "K": Qty.swiftConverter("tempK", "tempK"),
      "C": Qty.swiftConverter("tempK", "tempC"),
      "F": Qty.swiftConverter("tempK", "tempF")
    },
    'distance': {
      "m": Qty.swiftConverter('m', 'm'),
      "fathom": Qty.swiftConverter('m', 'fathom'),
      "feet": Qty.swiftConverter('m', 'foot'),
      "km": Qty.swiftConverter('m', 'km'),
      "nm": Qty.swiftConverter('m', 'nmi')
    },
    'volume': {
      "liter": Qty.swiftConverter('m^3', 'liter'),
      "gallon": Qty.swiftConverter('m^3', 'gallon'),
      "m3": Qty.swiftConverter('m^3', 'm^3'),
    },
    'electrical': {
      "volts": function(v) { return v; },
      "amps": function(v) { return v; },
    },
    'pressure': {
      "pascal": Qty.swiftConverter('pascal', 'pascal'),
      "hPa": Qty.swiftConverter('pascal', 'hPa'),
      "bar": Qty.swiftConverter('pascal', 'bar'),
      "mbar": Qty.swiftConverter('pascal', 'millibar'),
      "psi": Qty.swiftConverter('pascal', 'psi'),
      "mmHg": Qty.swiftConverter('pascal', 'mmHg')
    },
    'time': {
      "seconds": Qty.swiftConverter('s', 's'),
      "minutes": Qty.swiftConverter('s', 'minutes'),
      "hours": Qty.swiftConverter('s', 'hours'),
      "days": Qty.swiftConverter('s', 'days')
    },
    'angularVelocity': {
      "rad/s": Qty.swiftConverter('rad/s', 'rad/s'),
      "deg/s": Qty.swiftConverter('rad/s', 'deg/s'),
      "deg/min": Qty.swiftConverter('rad/s', 'deg/min')
    },
    'angle': {
      "rad": Qty.swiftConverter('rad', 'rad'),
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
