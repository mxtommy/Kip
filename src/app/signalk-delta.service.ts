import { Injectable } from '@angular/core';

import { SignalKService } from './signalk.service';

export interface updateMessage {
  source: {
    label: string;
    type: string;
    pgn?: string;
    src: string;
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

      let source = update.source.label + '.' + update.source.src;
      let timestamp = Date.parse(update.timestamp); //TODO, supposedly not reliable

      for (let value of update.values) {
        let fullPath = context + '.' + value.path;
        this.SignalKService.updatePathData(fullPath, source, timestamp, value.value);
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
] */
