import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject ,  BehaviorSubject } from 'rxjs';
import { SignalKService } from './signalk.service';
import { deltaMessage } from './signalk-interfaces';

@Injectable()
export class SignalKDeltaService {

  signalKRequests = new Subject<deltaMessage>(); // requests service subs to this (avoids circular dependency in services)

  constructor(private SignalKService: SignalKService) { }
  

  processWebsocketMessage(message: deltaMessage) {
    
    
    //handle Hello
    if (typeof(message.self) != 'undefined') {
      this.SignalKService.setSelf(message.self);
      return;
    }

    if (typeof(message.updates) != 'undefined') {
      this.processUpdateDelta(message);
    }

    if (typeof(message.requestId) != 'undefined') {
      this.signalKRequests.next(message); // send to signalk-request service
    }

  }

  processUpdateDelta(message:deltaMessage) {

      let context: string;
    if (typeof(message.context) == 'undefined') {
      context = 'self'; //default if not defined
    } else {
      context = message.context;
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
      } else if (update.source.label !== undefined) {
        source = update.source.label;
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
  public subcribeRequest (): Observable<deltaMessage> {
    return this.signalKRequests.asObservable();
  }

 }