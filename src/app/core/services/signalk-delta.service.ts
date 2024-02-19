import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, delay, Observable , retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { ISignalKDeltaMessage, ISignalKMeta, ISignalKUpdateMessage } from '../interfaces/signalk-interfaces';
import { IMeta, INotification, IPathValueData } from "../interfaces/app-interfaces";
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service'
import { AuthenticationService, IAuthorizationToken } from './authentication.service';


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

  // Signal K Requests message stream Observable
  private signalKRequests$ = new Subject<ISignalKDeltaMessage>();
  // Signal K Notifications message stream Observable
  private signalKNotifications$ = new Subject<INotificationDelta>();
  // Signal K data path message stream Observable
  private signalKDataPath$ = new Subject<IPathValueData>();
  // Signal K Metadata message stream Observer
  private signalKMetadata$ = new Subject<IMeta>();
  // Self URN message stream Observer
  private vesselSelfUrn$ = new Subject<string>();
  // local self URN to filter data based on root node (self or others)
  private selfUrn: string = undefined;

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
    private auth: AuthenticationService,
    private zones: NgZone
    )
    {
      // Monitor Connection Service Endpoint Status
      this.server.serverServiceEndpoint$.subscribe((endpointStatus: IEndpointStatus) => {
        let reason: string = null;
        if (endpointStatus.operation === 2) {
          reason = "New endpoint";
        } else {
          reason = "Connection stopped";
        }

        if (endpointStatus.operation === 2) {
          this.endpointWS = endpointStatus.WsServiceUrl;

          if (this.socketWS$ && this.streamEndpoint.operation !== 4) {
            this.closeWS(reason);
          }

          setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
            this.connectWS(reason);
          }, 250);

        } else {
          if (this.socketWS$ && endpointStatus.operation !== 1 && this.streamEndpoint.operation !== 4) {
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
    console.log(`[Delta Service] ${reason}: WebSocket opening...`);
    this.streamEndpoint$.next(this.streamEndpoint);

    this.socketWS$ = this.getNewWebSocket();
    // Every WebSocket onmessage listener event (data coming in) generates fires a ChangeDetection cycles that is not relevant in KIP. KIP sends socket messages to internal service data array only, so no UI updates (change detection) are necessary. UI Updates observing the internal data array updates. Running outside zones.js to eliminate unnecessary changedetection cycle.
    this.zones.runOutsideAngular(() => {
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
  * @param msg JSON formatted message to be sent. If the WebSocket is not
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
      console.log("[Delta Service] No WebSocket present to send message");
    }
  }

  private processWebsocketMessage(message: ISignalKDeltaMessage) {
    // We check updates first as it is by far the most frequent
    if (message.updates) {
      this.parseUpdates(message.updates, message.context); // process update

    } else if (message.requestId) {
      this.signalKRequests$.next(message); // is a Request/response, send to signalk-request service.

    } else if (message.errorMessage) {
      console.warn("[Delta Service] Service received stream error message: " + message.errorMessage); // server error message ie. socket failed or closing, sk bug, sk restarted, etc.

    } else if (message.self) {
      this.selfUrn = message.self;
      this.vesselSelfUrn$.next(message.self);
      this.server.setServerInfo(message.name, message.version, message.roles); // is server Hello message

    } else { // not in our list of message types....
      console.warn("[Delta Service] Unknown message type. Message content:" + message);
    }
  }

  private parseUpdates(updates: ISignalKUpdateMessage[], context: string): void {
    // if (context != this.selfUrn) {    // remove non self root nodes
    //   return
    // }
    for (let update of updates) {
      if (update.meta !== undefined) {
        // Meta message update
        for (let meta of update.meta) {
          this.parseMeta(meta, context);
        }
      } else if (update.$source !== undefined) {
        // Source value updates
        for (let item of update.values) {

          //TODO: notifications have evolved with the specs. Need to update at some point...
          if (/^notifications./.test(item.path)) {  // It's is a notification message, pass to notification service
            let notification: INotificationDelta = {
              path: item.path,
              notification: item.value,
            };
            this.signalKNotifications$.next(notification);

          } else {
            // It's a path value source update. Check if it's an Object. NOTE: null represents an undefined object and so is an object it's self, but in SK it should be handled as a value to mean: the path/source exists, but no value can ge generated. Ie. a depth sensor that can't read bottom depth in very deep water will send null.
            if ((typeof(item.value) == 'object') && (item.value !== null)) {

              let keys = Object.keys(item.value);
              for (let i = 0; i < keys.length; i++) {
                let dataPath: IPathValueData = {
                  context: context,
                  path: `${item.path}.${keys[i]}`,
                  source: update.$source,
                  timestamp: update.timestamp,
                  value: item.value[keys[i]],
                };
                if (update.$source == "defaults") { // defaults are SK special ship description values that have no path. Removing first dot so it attaches to self properly
                  if (item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }
                }
                if (context != this.selfUrn) { // data from non self root nodes may have no path. Removing first dot so it attaches to external root node context properly
                  if (item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }
                }
                this.signalKDataPath$.next(dataPath);
              }
            } else {
              // It's a Primitive type or a null value
              let dataPath: IPathValueData = {
                context: context,
                path: item.path,
                source: update.$source,
                timestamp: update.timestamp,
                value: item.value,
              };
              this.signalKDataPath$.next(dataPath);
            }
          }
        }
      }
    }
  }

  private parseMeta(metadata: ISignalKMeta, context: string) {
    let meta: IMeta;
    // does meta have one with properties for each one?
    if (metadata.value.properties !== undefined) {
      Object.keys(metadata.value.properties).forEach(key => {
        meta = {
          context: context,
          path: `${metadata.path}.${key}`,
          meta: metadata.value.properties[key],
        };
        this.signalKMetadata$.next(meta);
      })
    } else {
      meta = {
        context: context,
        path: metadata.path,
        meta: metadata.value,
      };
      this.signalKMetadata$.next(meta);
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
    return this.signalKDataPath$.asObservable();
  }

  public subscribeMetadataUpdates() : Observable<IMeta> {
    return this.signalKMetadata$.asObservable();
  }

  public subscribeSelfUpdates(): Observable<string> {
    return this.vesselSelfUrn$.asObservable();
  }

  /**
  * Close the WebSocket on app termination. This send a Close to the server for
  * a clean disconnect. Else the server keeps buffering the messages that creates
  * an overflow.
  *
  * @memberof SignalKDeltaService
  */
  OnDestroy(): void {
    this.closeWS("App terminated");
  }

 }
