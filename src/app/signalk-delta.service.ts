import { Injectable } from '@angular/core';

import { SignalKService } from './signalk.service';

export interface updateMessage {
  source: {
    label: string;
    type: string;
    pgn?: string;
    src?: string;
    talker?: string;
  };
  timestamp: string;
  values: {
    path: string;
    value: any;
  }[]
}

export interface deltaMessage {
  updates: updateMessage[];
  context: string;
  self?: string;
}

@Injectable()
export class SignalKDeltaService {

  constructor(private SignalKService: SignalKService,) { }
  

  processWebsocketMessage(message: deltaMessage) {
    let context: string;
    if (typeof(message.context) == 'undefined') {
      context = 'vessels.self'; //default if not defined
    } else {
      context = message.context;
    }
     
    
    //handle Hello
    if (typeof(message.self) != 'undefined') {
      this.SignalKService.setSelf(message.self);
      return;
    }
    for (let update of message.updates) {

      // get source identifyer. is 'src' on nmea2k and 'talker' on nmea0183
      let source = '';
      if ((update.source !== undefined) && (update.source.type !== undefined) && update.source.label !== undefined) {
        if (update.source.type == 'NMEA2000') {
          source = update.source.label + '.' + update.source.src;
        } else if (update.source.type == 'NMEA0183') {
          source = update.source.label + '.' + update.source.talker;
        } else {
          // donno what it is...
          source = update.source.label;
        }
      } else if (update['$source'] !== undefined) {
        source = update['$source'];
      } else if ((update.source !== undefined) && (update.source.src !== undefined) && (update.source.label !== undefined)) {
        source = update.source.label + '.' + update.source.src;
      } else {
        source = "unknown";
      }
      

      
      let timestamp = Date.parse(update.timestamp); //TODO, supposedly not reliable
      for (let value of update.values) {
        let fullPath = context + '.' + value.path;
        if ( (typeof(value.value) == 'object') && (value.value !== null)) {
          // compound data
          let keys = Object.keys(value.value);
          for (let i = 0; i < keys.length; i++) {
            this.SignalKService.updatePathData(fullPath + '.' + keys[i], source, timestamp, value.value[keys[i]]);
          } 
        } else {
          // simple data
          this.SignalKService.updatePathData(fullPath, source, timestamp, value.value);
        }

      }
    }
  }


}
/*
{"updates":
[
	{
    "source":
			{
				"label":"n2kFromFile",
				"type":"NMEA2000",
				"pgn":128259,"src":"115"},
				"timestamp":"2014-08-15T19:00:44.094",
				"values":[
          {
            "path":"navigation.speedThroughWater",
            "value":3.5
          }
          ]
      }
    ],
    "context":"vessels.urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d"
  }
]

{
  "updates":
  [
    {
      "source":
        {
          "label":"n2kFromFile",
          "type":"NMEA2000",
          "pgn":129029,
          "src":"160"
        },
        "timestamp":"2014-08-15T19:05:48.955",
        "values":
        [
          {
            "path":"navigation.position",
            "value": {
              "longitude":24.730489,
              "latitude":59.7147167
            }
          },
          {
            "path":"navigation.gnss.satellites",
            "value":10
          },
          {
            "path":"navigation.gnss.horizontalDilution",
            "value":0.8
          },
          {
            "path":"navigation.gnss.geoidalSeparation",
            "value":-0.01
          },
          {
            "path":"navigation.gnss.differentialReference",
            "value":7
          },
          {
            "path":"navigation.gnss.type",
            "value":"GPS"
          },
          {
            "path":"navigation.gnss.methodQuality",
            "value":"GNSS Fix"
          },
          {
            "path":"navigation.gnss.integrity",
            "value":"no Integrity checking"
          }
        ]
      }
    ],
    "context":"vessels.urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d"
  }
}

*/
