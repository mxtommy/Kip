import { DestroyRef, inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, delay, Observable, of, retry, Subject, fromEvent } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { ISignalKDataValueUpdate, ISignalKDeltaMessage, ISignalKMeta, ISignalKUpdateMessage } from '../interfaces/signalk-interfaces';
import { IMeta, IPathValueData } from "../interfaces/app-interfaces";
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service'
import { AuthenticationService, IAuthorizationToken } from './authentication.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


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

@Injectable({
    providedIn: 'root'
  })
export class SignalKDeltaService implements OnDestroy {
  private _destroyRef = inject(DestroyRef); // Inject DestroyRef

  // Signal K Requests message stream Observable
  private _skRequests$ = new Subject<ISignalKDeltaMessage>();
  // Signal K Notifications message stream Observable
  private _skNotificationsMsg$ = new Subject<ISignalKDataValueUpdate>();
  // Signal K data path message stream Observable
  private _skValue$ = new Subject<IPathValueData>();
  // Signal K Metadata message stream Observer
  private _skMetadata$ = new Subject<IMeta>();
  // Self URN message stream Observer
  private _vesselSelfUrn$ = new Subject<string>();
  // local self URN to filter data based on root node (self or others)
  private _selfUrn: string = undefined;

  // Delta Service Endpoint status publishing
  public streamEndpoint: IStreamStatus = {
    operation: 0,
    message: "Not connected",
    hasToken: false,
  }
  public streamEndpoint$: BehaviorSubject<IStreamStatus> = new BehaviorSubject<IStreamStatus>(this.streamEndpoint);

  // Websocket config
  private endpointWS: string = null;
  private SubscriptionType: string = "self";
  private readonly WS_RECONNECT_INTERVAL = 3000;                 // connection error retry interval
  private readonly WS_RETRY_COUNT = 3;                 // connection error retry interval
  private readonly WS_CONNECTION_SUBSCRIBE = "?subscribe=";
  private readonly WS_CONNECTION_META = "&sendMeta=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<any>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();

  // Token
  private authToken: IAuthorizationToken = null;

  // Array to store the timeout IDs
  private timeoutIds: NodeJS.Timeout[] = [];

  private server = inject(SignalKConnectionService);
  private auth = inject(AuthenticationService);
  private zones = inject(NgZone); // NgZone to run outside Angular zone - NOT to be confused with SK zones

  constructor() {
    // Monitor Connection Service Endpoint Status
    this.server.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((endpointStatus: IEndpointStatus) => {
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

          this.timeoutIds.push(setTimeout(() => { this.connectWS(reason) }, 250)); // need a delay so WebSocket Close Observer has time to complete before connecting again.

        } else {
          if (this.socketWS$ && endpointStatus.operation !== 1 && this.streamEndpoint.operation !== 4) {
            this.closeWS(reason);
          }
        }

        endpointStatus.subscribeAll ? this.SubscriptionType = "all" : this.SubscriptionType = "self"; // set subscription type
    });

    // Monitor Token changes
    this.auth.authToken$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((token: IAuthorizationToken) => {
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
            this.timeoutIds.push(setTimeout(() => { this.connectWS(reason) }, 250)); // need a delay so WebSocket Close Observer has time to complete before connecting again.
          }
        }
    });

    // WebSocket Open Event Handling
    this.socketWSOpenEvent$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe( event => {
        this.streamEndpoint.message = "Connected";
        this.streamEndpoint.operation = 2;
        if (this.authToken) {
          console.log("[Delta Service] WebSocket connected with Authorization Token")
        } else {
          console.log("[Delta Service] WebSocket connected without Authorization Token");
        }
        this.streamEndpoint$.next(this.streamEndpoint);
    });

    // WebSocket closed Event Handling
    this.socketWSCloseEvent$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe( event => {
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

    // Listen for visibility (app suspend, background or screenlock) change events
    fromEvent(document, 'visibilitychange')
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible') {
          console.log('[Delta Service] App resumed, checking WebSocket connection...');
          this.checkAndReconnect('App resumed');
        } else if (document.visibilityState === 'hidden') {
          console.log('[Delta Service] App suspended');
          // Optional: Handle app suspension logic here if needed
        }
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

    // Running outside Angular's zone to prevent unnecessary change detection cycles
    this.zones.runOutsideAngular(() => {
      this.socketWS$.pipe(
        retry({
          count: this.WS_RETRY_COUNT,
          delay: (error, retryCount) => {
            console.error(`[Delta Service] WebSocket error (attempt ${retryCount}): ${JSON.stringify(error, ["code", "message", "type"])}`);
            return of(error).pipe(delay(this.WS_RECONNECT_INTERVAL));
          }
        })
      ).pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: msgWS => this.processWebsocketMessage(msgWS),
        error: err => console.error('[Delta Service] WebSocket connection failed after maximum retries:', err)
      });
    });
  }

  /**
   * Handles connection arguments, token and links socket Open/Close Observers
   */
  private getNewWebSocket() {
    let args = this.WS_CONNECTION_SUBSCRIBE + this.SubscriptionType + this.WS_CONNECTION_META;
    if (this.authToken != null) {
      args += "&token=" + this.authToken.token;
      this.streamEndpoint.hasToken = true;
    } else {
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
  public publishDelta(msg: any): void {
    if (this.socketWS$) {
      console.log("[Delta Service] WebSocket sending message");
      this.socketWS$.next(msg);
    } else {
      this.timeoutIds.push(setTimeout(() => {
        if (this.socketWS$) {
          console.log("[Delta Service] WebSocket retry sending message");
          this.socketWS$.next(msg);
        }
       }, 1000));
      console.log("[Delta Service] No WebSocket present to send message");
    }
  }

  private processWebsocketMessage(message: ISignalKDeltaMessage) {
    if (message.updates) {
      this.parseUpdates(message.updates, message.context);
      return;
    }

    if (message.requestId) {
      this._skRequests$.next(message);
      return;
    }

    if (message.errorMessage) {
      console.warn("[Delta Service] Service received stream error message: " + message.errorMessage);
      return;
    }

    if (message.self) {
      this._selfUrn = message.self;
      this._vesselSelfUrn$.next(message.self);
      this.server.setServerInfo(message.name, message.version, message.roles);
      return;
    }

    console.warn("[Delta Service] Unknown message type. Message content:" + message);
  }

  private parseUpdates(updates: ISignalKUpdateMessage[], context: string): void {
    // if (context != this._selfUrn) {    // remove non self root nodes
    //   return;
    // }

    updates.forEach(update => {
      if (update.meta !== undefined) {
        update.meta.forEach(meta => this.parseSkMeta(meta, context));
      }

      if (update.values !== undefined) {
        update.values.forEach(item => {
          if (item.path.startsWith("notifications.")) {  // It's a notification message, pass to notification service
            this._skNotificationsMsg$.next(item);
          } else {
            // It's a path value source update.
            if ((typeof(item.value) == 'object') && (item.value !== null)) {
              Object.keys(item.value).forEach(key => {
                const dataPath: IPathValueData = {
                  context: context,
                  path: `${item.path}.${key}`,
                  source: update.$source,
                  timestamp: update.timestamp,
                  value: item.value[key],
                };

                if (update.$source == "defaults" && item.path == "") { // defaults are SK special ship description values that have no path. Removing first dot so it attaches to self properly
                  dataPath.path = dataPath.path.slice(1);
                }

                if (context != this._selfUrn && item.path == "") { // data from non self root nodes (other vessel, atoms, stations, buoy, etc.) may have no path. Removing first dot so it attaches to external root node context properly
                  dataPath.path = dataPath.path.slice(1);
                }

                this._skValue$.next(dataPath);
              });
            } else {
              // It's a Primitive type or a null value
              const dataPath: IPathValueData = {
                context: context,
                path: item.path,
                source: update.$source,
                timestamp: update.timestamp,
                value: item.value,
              };
              this._skValue$.next(dataPath);
            }
          }
        });
      }
    });
  }

  private parseSkMeta(metadata: ISignalKMeta, context: string) {
    if (metadata.value.properties !== undefined) {
      Object.keys(metadata.value.properties).forEach(key => {
        this._skMetadata$.next({
          context: context,
          path: `${metadata.path}.${key}`,
          meta: metadata.value.properties[key],
        });
      });
    } else {
      this._skMetadata$.next({
        context: context,
        path: metadata.path,
        meta: metadata.value,
      });
    }
  }

  // WebSocket Stream Status observable
  getDataStreamStatusAsO() {
    return this.streamEndpoint$.asObservable();
  }

  public subscribeRequestUpdates(): Observable<ISignalKDeltaMessage> {
    return this._skRequests$.asObservable();
  }

  public subscribeNotificationsUpdates(): Observable<ISignalKDataValueUpdate> {
    return this._skNotificationsMsg$.asObservable();
  }

  public subscribeDataPathsUpdates() : Observable<IPathValueData> {
    return this._skValue$.asObservable();
  }

  public subscribeMetadataUpdates() : Observable<IMeta> {
    return this._skMetadata$.asObservable();
  }

  public subscribeSelfUpdates(): Observable<string> {
    return this._vesselSelfUrn$.asObservable();
  }

  /**
   * Check the WebSocket connection status and reconnect if necessary.
   * @param reason Reason for triggering the reconnection logic.
   */
  private checkAndReconnect(reason: string): void {
    if (this.streamEndpoint.operation !== 2) { // Not connected
      console.log(`[Delta Service] ${reason}: WebSocket not connected, attempting to reconnect...`);
      this.closeWS(reason); // Ensure any existing connection is closed
      this.timeoutIds.push(setTimeout(() => this.connectWS(reason), 250)); // Reconnect with a slight delay
    } else {
      console.log(`[Delta Service] ${reason}: WebSocket is already connected.`);
    }
  }

  /**
  * Close the WebSocket on app termination. This send a Close to the server for
  * a clean disconnect. Else the server keeps buffering the messages that creates
  * an overflow.
  *
  * @memberof SignalKDeltaService
  */
  ngOnDestroy(): void {
    this.closeWS("App terminated");

    // Complete all the Observables
    this._skRequests$.complete();
    this._skNotificationsMsg$.complete();
    this._skValue$.complete();
    this._skMetadata$.complete();

    this._vesselSelfUrn$.complete();
    this.streamEndpoint$.complete();
    this.socketWSOpenEvent$.complete();
    this.socketWSCloseEvent$.complete();
    this.socketWS$?.complete();
    // Clear all the timers
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
  }
}
