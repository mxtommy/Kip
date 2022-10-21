import { Injectable } from '@angular/core';
import { Observable , Subject, Subscription } from 'rxjs';

import { SignalKConnectionService } from './signalk-connection.service'
import { SignalKService } from './signalk.service';
import { IDeltaMessage } from './signalk-interfaces';
import { NotificationsService } from './notifications.service';

@Injectable({
    providedIn: 'root'
  })
export class SignalKDeltaService {
  private signalKRequests = new Subject<IDeltaMessage>();   // requests service subs to this (avoids circular dependency in services)
  //private socketCloseSubject$: Subscription;                 // WebSocket Event Observable - keep as a template
  //private socketOpenSubject$: Subscription;

  constructor(
    private signalKService: SignalKService,
    private notificationsService: NotificationsService,
    private server: SignalKConnectionService,
    )
    {
      // Subscribe to inbound WebSocket messages
      this.server.messagesWS$.subscribe({
        next: msg => this.processWebsocketMessage(msg), // Called whenever there is a message from the server.
        error: err => console.error("[Delta Service] Message subscription error: " + JSON.stringify(err, ["code", "message", "type"])), // Called if at any point WebSocket API signals some kind of error.
        complete: () => console.log('[Delta Service] Message subscription closed') // Called when connection is closed (for whatever reason).
      });

      /* Keeping as sample. Same patern for Open and Close
      this.socketCloseSubject = this.signalKConnectionService.socketWSCloseEvent.subscribe(
        event => {
          if(event.wasClean) {
            console.log('[Delta Service] **** closed');
          } else {
            console.log('[Delta Service] **** error');
          }
        }
      ); */
    }

  public publishDelta(message: any) {
    this.server.sendMessageWS(message);
  }

  private processWebsocketMessage(message: IDeltaMessage) {
    // Read raw message and route to appropriate sub
    if (typeof(message.self) != 'undefined') {  // is Hello message
      this.server.setServerInfo(message.name, message.version, message.roles);
      this.signalKService.setSelf(message.self);
      return;
    }


    if (typeof(message.updates) != 'undefined') {
      this.processUpdateDelta(message); // is Data Update process further
    } else if (typeof(message.requestId) != 'undefined') {
      this.signalKRequests.next(message); // is a Request, send to signalk-request service.
    } else {
      console.log("[Delta Service] Unknown message type. Message content:" + message);
    }
  }

  private processUpdateDelta(message:IDeltaMessage) {
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
          if (value.path == '') { fullPath = context; } // if path is empty we shouldn't have a . at the end
          if ( (typeof(value.value) == 'object') && (value.value !== null)) {
            // compound data
            let keys = Object.keys(value.value);
            for (let i = 0; i < keys.length; i++) {
              this.signalKService.updatePathData(fullPath + '.' + keys[i], source, timestamp, value.value[keys[i]]);
            }
          } else {
            // simple data
            this.signalKService.updatePathData(fullPath, source, timestamp, value.value);
          }
        }
      }
    }
  }

  public subscribeRequest(): Observable<IDeltaMessage> {
    return this.signalKRequests.asObservable();
  }

 }
