import { Injectable } from '@angular/core';
import { Observable , Subject, Subscription, timer } from 'rxjs';

import { SignalKConnectionService, SignalKStatus } from './signalk-connection.service'
import { SignalKService } from './signalk.service';
import { IDeltaMessage } from './signalk-interfaces';
import { NotificationsService } from './notifications.service';
import { AppSettingsService } from './app-settings.service';

@Injectable({
    providedIn: 'root'
  })
export class SignalKDeltaService {

  private signalKConnectionsStatusSub: Subscription;        // Monitor if Endpoints are reset
  private signalKConnectionsStatus: SignalKStatus;
  private signalKRequests = new Subject<IDeltaMessage>();   // requests service subs to this (avoids circular dependency in services)
  private socketCloseSubject: Subscription;                 // WebSocket Close Event Observable
  private socketOpenSubject: Subscription;

  constructor(
    private SignalKService: SignalKService,
    private notificationsService: NotificationsService,
    private signalKConnectionService: SignalKConnectionService,
    private appSettingsService: AppSettingsService
    )
    {
      // Server HTTP connection status monitoring
      this.signalKConnectionsStatusSub = this.signalKConnectionService.getSignalKConnectionsStatus().subscribe(
        signalKConnections => {
          this.signalKConnectionsStatus = signalKConnections;

          //Handle WebSocket connection operations
          if (signalKConnections.endpoint.status && !signalKConnections.websocket.status) {
            this.signalKConnectionService.connectWS();
          } else if (!signalKConnections.endpoint.status && signalKConnections.websocket.status) {
              this.signalKConnectionService.closeWS();
            }
        }
      );

      // WebSocket open/close event handling
      this.socketOpenSubject = this.signalKConnectionService.socketWSOpenEvent.subscribe(
        event => {
          if (!this.signalKConnectionsStatus.websocket.hasToken && !this.appSettingsService.useDeviceToken) {
            this.appSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: true, isExpired: true});
          }
        }
      );
      /* this.socketCloseSubject = this.signalKConnectionService.socketWSCloseEvent.subscribe(
        event => {
          if(event.wasClean) {
            console.log('[Delta Service] **** closed');
          } else {
            console.log('[Delta Service] **** error');
          }
        }
      ); */

      // Subscribe to inbound WebSocket messages
      this.signalKConnectionService.messagesWS$.subscribe({
        next: msg => this.processWebsocketMessage(msg), // Called whenever there is a message from the server.
        error: err => console.error("[Delta Service] Message subscription error: " + JSON.stringify(err, ["code", "message", "type"])), // Called if at any point WebSocket API signals some kind of error.
        complete: () => console.log('[Delta Service] Message subscription closed') // Called when connection is closed (for whatever reason).
      });
    }

  public publishDelta(message: any) {
    this.signalKConnectionService.sendMessageWS(message);
  }

  processWebsocketMessage(message: IDeltaMessage) {
    // Read raw message and route to appropriate sub
    if (typeof(message.self) != 'undefined') {  // is Hello message
      let tokenType: string;

      this.SignalKService.setServerInfo(message.version, message.name);
      if (this.signalKConnectionService.signalKToken.isSessionToken){
        tokenType = "User";
      } else tokenType = "Device"
      console.log("[Delta Service] Connection details - Token : " + this.signalKConnectionService.currentSkStatus.websocket.hasToken + ", Token Type: " + tokenType);
      this.SignalKService.setSelf(message.self);
      return;
    }


    if (typeof(message.updates) != 'undefined') {
      this.processUpdateDelta(message); // is Data Update process further
    } else if (typeof(message.requestId) != 'undefined') {
      this.signalKRequests.next(message); // is a Request, send to signalk-request service.
    } else {
      let unknownMessageContent = JSON.stringify(message);
      if (unknownMessageContent == '"{message: \\"Connection disconnected by security constraint\\"}"') {
        if (this.signalKConnectionService.signalKToken.isSessionToken) {
          console.log("[Delta Service] User Security Token expired. Server message: " + unknownMessageContent);
          this.appSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: true, isExpired: false});
        } else {
          console.log("[Delta Service] Device Security Token expired. Switching to tokenless connnection. Manual Device Token request is required to re-establish a secure connection. Server message: " + unknownMessageContent);
          this.appSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: false, isExpired: true});
        }

      } else
      console.log("[Delta Service] Unknown message type. Message content:" + unknownMessageContent);
    }
  }

  public processUpdateDelta(message:IDeltaMessage) {
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

  public subscribeRequest(): Observable<IDeltaMessage> {
    return this.signalKRequests.asObservable();
  }

 }
