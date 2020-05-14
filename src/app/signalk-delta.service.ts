import { Injectable } from '@angular/core';
import { Observable ,  Subject, Subscription } from 'rxjs';
import { SignalKService } from './signalk.service';
import { deltaMessage } from './signalk-interfaces';
import { NotificationsService } from './notifications.service';
import { AppSettingsService } from "./app-settings.service";


@Injectable()
export class SignalKDeltaService {

  signalKRequests = new Subject<deltaMessage>();      // requests service subs to this (avoids circular dependency in services)

  constructor(
    private SignalKService: SignalKService,
    private notificationsService: NotificationsService,
    ) { }

  processWebsocketMessage(message: deltaMessage) {
    // Read raw message and route to appropriate sub
    if (typeof(message.self) != 'undefined') {  // is Hello message
      this.SignalKService.setSelf(message.self);
      this.SignalKService.setServerVersion(message.version);
      return;
    }


    if (typeof(message.updates) != 'undefined') {
      this.processUpdateDelta(message); // is Data Update process further
    }

    if (typeof(message.requestId) != 'undefined') {
      this.signalKRequests.next(message); // is a Request, send to signalk-request service.
    }

  }

  public processUpdateDelta(message:deltaMessage) {
    let context: string;
    if (typeof(message.context) == 'undefined') {
      context = 'self'; //default if not defined
    } else {
      context = message.context;
    }

    // process message Updates
    for (let update of message.updates) {
      // get source identifier. 'src' is nmea2k and 'talker' is nmea0183
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

      // process message values
      let timestamp = Date.parse(update.timestamp); //TODO, supposedly not reliable
      for (let value of update.values) {
        if (/^notifications./.test(value.path)) {   // is a notification message, pass to notification service
          this.notificationsService.processNotificationDelta(value.path, value.value);
        } else {
          // it's a data update. Update local tree
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

  public subscribeRequest(): Observable<deltaMessage> {
    return this.signalKRequests.asObservable();
  }

 }
