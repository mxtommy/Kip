import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable , retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { ISignalKDeltaMessage, ISignalKMeta, ISignalKMetadata, ISignalKUpdateMessage } from './signalk-interfaces';
import { IMeta, INotification, IPathValueData } from "./app-interfaces";
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service'
import { AuththeticationService, IAuthorizationToken } from './auththetication.service';


/**
 * Operation value represent connection statuses.
 * @usageNotes `operation` field describes the type of operation being
 * performed on the connections.
 * `0 = Stopped
 * `1 = Connecting (connection being set up/under execution)
 * `2 = Connected
 * `3 = Error connecting
 * `4 = Resetting
 */
export interface IStreamStatus {
  operation: number;
  message: string;
  hasToken: boolean;
}

export interface INotificationDelta {
  path: string;
  notification: INotification;
}

@Injectable({
    providedIn: 'root'
  })
export class SignalKDeltaService {

  // SignalK Requests message stream Observable
  private signalKRequests$ = new Subject<ISignalKDeltaMessage>();
  // SignalK Notifications message stream Observable
  private signalKNotifications$ = new Subject<INotificationDelta>();
  // SignalK data path message stream Observable
  private signalKDatapath$ = new Subject<IPathValueData>();
  // SignalK Metadata message stream Observer
  private signalKMetadata$ = new Subject<IMeta>();
  // Self URN message stream Observer
  private vesselSelfUrn$ = new Subject<string>();

  // Delta Service Endpoint status publishing
  public streamEndpoint: IStreamStatus = {
    operation: 0,
    message: "Not connected",
    hasToken: false,
  }
  public streamEndpoint$: BehaviorSubject<IStreamStatus> = new BehaviorSubject<IStreamStatus>(this.streamEndpoint);

  // Websocket config
  private endpointWS: string = null;
  private WS_RECONNECT_INTERVAL = 5000;                 // connection error retry interval
  private WS_CONNECTION_ARGUMENT = "?subscribe=all&sendMeta=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<any>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();

  // Token
  private authToken: IAuthorizationToken = null;

  constructor(
    private server: SignalKConnectionService,
    private auth: AuththeticationService,
    )
    {
      // Monitor Connection Service Endpoint Status
      this.server.serverServiceEndpoint$.subscribe((endpoitStatus: IEndpointStatus) => {
        let reason: string = null;
        if (endpoitStatus.operation === 2) {
          reason = "New endpoint";
        } else {
          reason = "Connection stopped";
        }

        if (endpoitStatus.operation === 2) {
          this.endpointWS = endpoitStatus.WsServiceUrl;

          if (this.socketWS$ && this.streamEndpoint.operation !== 4) {
            this.closeWS(reason);
          }

          setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
            this.connectWS(reason);
          }, 250);

        } else {
          if (this.socketWS$ && endpoitStatus.operation !== 1 && this.streamEndpoint.operation !== 4) {
            this.closeWS(reason);
          }
        }
      });

      // Monitor Token changes
      this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
        if (this.authToken != token) { // When token changes, reconnect WebSocket with new token
          this.authToken = token;

          let reason: string = null;
          if (token) {
            reason = "New token";
          } else {
            reason = "Deleted Token";
          }

          // Only if the socket is in Connected or Connecting state.
          if (this.socketWS$ && (this.streamEndpoint.operation === 2 || this.streamEndpoint.operation === 1) ) {
            this.closeWS(reason);

            setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
              this.connectWS(reason);
            }, 250);
          }
        }
      });

      // WebSocket Open Event Handling
      this.socketWSOpenEvent$.subscribe( event => {
          this.streamEndpoint.message = "Connected";
          this.streamEndpoint.operation = 2;
          if (this.authToken) {
            console.log("[Delta Service] WebSocket connected with Authorization Token")
          } else {
            console.log("[Delta Service] WebSocket connected without Authorization Token");
          }
          this.streamEndpoint$.next(this.streamEndpoint);
        }
     );

      // WebSocket closed Event Handling
      this.socketWSCloseEvent$.subscribe( event => {
        if(event.wasClean) {
          this.streamEndpoint.message = "WebSocket closed";
          this.streamEndpoint.operation = 0;
          console.log('[Delta Service] WebSocket closed');
        } else {
          console.log('[Delta Service] WebSocket terminated due to socket error');
          this.streamEndpoint.message = "WebSocket error";
          this.streamEndpoint.operation = 3;
          console.log('[Delta Service] WebSocket closed');
        }
        this.streamEndpoint$.next(this.streamEndpoint);
      });
    }

  /**
   * Connect WebSocket to server. Endpoint URL taken from Connection Service and
   * authentication token is taken from Authentication service
   */
   public connectWS(reason: string): void {
    this.streamEndpoint.message = "Connecting";
    this.streamEndpoint.operation = 1;
    console.log(`[Delta Service] ${reason}: WebSocket openning...`);
    this.streamEndpoint$.next(this.streamEndpoint);

    this.socketWS$ = this.getNewWebSocket();
    this.socketWS$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => {
            console.error("[Delta Service] WebSocket error: " + JSON.stringify(err, ["code", "message", "type"]))
          }),
          delay(this.WS_RECONNECT_INTERVAL)
        )
      )
    ).subscribe(msgWS => {
      this.processWebsocketMessage(msgWS);
    });
  }

  /**
   * Handles connection arguments, token and links socket Open/Close Observers
   */
  private getNewWebSocket() {
    let args: string;
    if (this.authToken != null) {
      args = this.WS_CONNECTION_ARGUMENT + "&token=" + this.authToken.token;
      this.streamEndpoint.hasToken = true;
    } else {
      args = this.WS_CONNECTION_ARGUMENT;
      this.streamEndpoint.hasToken = false;
    }
    return webSocket({
      url: this.endpointWS + args,
      closeObserver: this.socketWSCloseEvent$,
      openObserver: this.socketWSOpenEvent$
    })
  }

  /**
  * Close Signal K server data stream WebSocket
  */
  public closeWS(reason: string) {
    if (this.socketWS$) {
      this.streamEndpoint.operation = 4; // closing status. Internal - no need to push to Observers
      console.log("[Delta Service] " + reason + ": WebSocket closing...");
      this.socketWS$.complete();
    }
  }

  /**
  * Send message to WebSocket stream recipient (SignalK server).
  * @param msg JSON formated message to be sent. If the WebSocket is not
  * available, one retry after 1 sec will be made. The socket parser will automatically
  * stringify the message.
  *
  * `*** Do not pre-stringify the msg param ***`
  */
  public publishDelta(msg: any) {
    if (this.socketWS$) {
      console.log("[Delta Service] WebSocket sending message");
      this.socketWS$.next(msg);
    } else {
      setTimeout((): void => {
        console.log("[Delta Service] WebSocket retry sending message");
        this.socketWS$.next(msg);
      }, 1000);
      console.log("[Delta Service] No WebSocket present to send messsage");
    }
  }

  private processWebsocketMessage(message: ISignalKDeltaMessage) {
    // We check updates first as it is by far the most frequent
    if (message.updates) {
      this.parseUpdates(message.updates, message.context); // process update

    } else if (message.requestId) {
      this.signalKRequests$.next(message); // is a Request/response, send to signalk-request service.

    } else if (message.errorMessage) {
      console.warn("[Delta Service] Service sent stream error message: " + message.errorMessage); // server error message ie. socket failed or closing, sk bug, sk restarted, etc.

    } else if (message.self) {
      this.vesselSelfUrn$.next(message.self);
      this.server.setServerInfo(message.name, message.version, message.roles); // is server Hello message

    } else { // not in our list of message types....
      console.warn("[Delta Service] Unknown message type. Message content:" + message);
    }
  }

  private parseUpdates(updates: ISignalKUpdateMessage[], context: string) {
    if (!context) {
      context = 'self'; //default if not defined
    }

    for (let update of updates) {
      // process source identifier. 'src' is nmea2k and 'talker' is nmea0183
      let source: string = null;
      if ((update.source) && (update.source.type) && update.source.label) {
        if (update.source.type == 'NMEA2000') {
          source = update.source.label + '.' + update.source.src;
        } else if (update.source.type == 'NMEA0183') {
          source = update.source.label + '.' + update.source.talker;
        } else {
          // donno what it is...
          source = update.source.label;
        }
      } else if (update.$source !== undefined) {
        source = update.$source;
      } else if ((update.source !== undefined) && (update.source.src !== undefined) && (update.source.label !== undefined)) {
        source = update.source.label + '.' + update.source.src;
      } else if ((update.source !== undefined) && (update.source.label !== undefined)) {
        source = update.source.label;
      } else {
        source = "Unknown";
      }

      // process Values
      let timestamp = Date.parse(update.timestamp); //TODO, supposedly not reliable
      if (update.values !== undefined) {
        for (let item of update.values) {


          //TODO:  notification are in path vessels.self.navigation...
          if (/^notifications./.test(item.path)) {
            // It's is a notification message, pass to notification service
            let notification: INotificationDelta = {
              path: item.path,
              notification: item.value,
            };
            this.signalKNotifications$.next(notification);
          } else {
            // It's a data update. Update local source
            let fullPath = `${context}.${item.path}`;
            if (item.path == '') { fullPath = context; } // if path is empty we shouldn't have a . at the end
            if ( (typeof(item.value) == 'object') && (item.value !== null)) {
              // It's contains compounded data
              let keys = Object.keys(item.value);
              for (let i = 0; i < keys.length; i++) {
                let dataPath: IPathValueData = {
                  path: fullPath + `.` + keys[i],
                  source: source,
                  timestamp: timestamp,
                  value: item.value[keys[i]],
                };
                this.signalKDatapath$.next(dataPath);
              }
            } else {
              // It's a simple data
              let dataPath: IPathValueData = {
                path: fullPath,
                source: source,
                timestamp: timestamp,
                value: item.value,
              };
              this.signalKDatapath$.next(dataPath);
            }
          }
        }
      }

      // Process Meta
      if (update.meta !== undefined) {
        for (let meta of update.meta) {
          this.parseMeta(meta, context);
        }
      }
    }
  }

  private parseMeta(metadata: ISignalKMeta, context: string) {
    if (Object.keys(metadata).length === 0) {
      return;
    } else {
      let meta: IMeta;
      // does meta have one with properties for each one?
      if (metadata.value.properties !== undefined) {
        Object.keys(metadata.value.properties).forEach(key => {
          meta = {
            path: `${context}.${metadata.path}.${key}`,
            meta: metadata.value.properties[key],
          };
          this.signalKMetadata$.next(meta);
        })
      } else {
        meta = {
          path: `${context}.${metadata.path}`,
          meta: metadata.value,
        };
        this.signalKMetadata$.next(meta);
      }
    }
  }

  // WebSocket Stream Status observable
  getDataStreamStatusAsO() {
    return this.streamEndpoint$.asObservable();
  }

  public subscribeRequestUpdates(): Observable<ISignalKDeltaMessage> {
    return this.signalKRequests$.asObservable();
  }

  public subscribeNotificationsUpdates(): Observable<INotificationDelta> {
    return this.signalKNotifications$.asObservable();
  }

  public subscribeDataPathsUpdates() : Observable<IPathValueData> {
    return this.signalKDatapath$.asObservable();
  }

  public subscribeMetadataUpdates() : Observable<IMeta> {
    return this.signalKMetadata$.asObservable();
  }

  public subscribeSelfUpdates(): Observable<string> {
    return this.vesselSelfUrn$.asObservable();
  }

  /**
  * Close the WebSocket on app termination. This send a Close to the server for
  * a clean disconnect. Else the server keeps buffering the messages and it creates an
  *
  * @memberof SignalKDeltaService
  */
  OnDestroy(): void {
    this.closeWS("App terminated");
  }

 }
