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
  private readonly _destroyRef = inject(DestroyRef); // Inject DestroyRef

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
  private SubscriptionType = "self";
  private readonly WS_RECONNECT_INTERVAL = 5000;       // connection error retry interval
  private readonly WS_RETRY_COUNT = 5;                 // connection error retry interval
  private readonly WS_CONNECTION_SUBSCRIBE = "?subscribe=";
  private readonly WS_CONNECTION_META = "&sendMeta=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<object>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();

  // Token
  private authToken: IAuthorizationToken = null;

  // Array to store the timeout IDs
  private timeoutIds: NodeJS.Timeout[] = [];

  private server = inject(SignalKConnectionService);
  private auth = inject(AuthenticationService);
  private zones = inject(NgZone); // NgZone to run outside Angular zone - NOT to be confused with SK zones

  // Object flattening configuration - conservative settings for performance
  private readonly FLATTEN_CONFIG = {
    maxDepth: 3,        // Object recursive depth limit
    maxObjectSize: 20,  // Object number of property limit
    enableFlattening: true // Enable or disable recursive flattening of objects
  };

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

        if (endpointStatus.subscribeAll) {
          this.SubscriptionType = "all";
        } else {
          this.SubscriptionType = "self";
        } // set subscription type
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
      .subscribe( () => {
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
  private getNewWebSocket(): WebSocketSubject<object> {
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
  public publishDelta(msg: object): void {
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
              // Check if recursive flattening is enabled and possible
              if (this.FLATTEN_CONFIG.enableFlattening &&
                  this.canFlattenCompletely(item.value, this.FLATTEN_CONFIG.maxDepth, this.FLATTEN_CONFIG.maxObjectSize)) {

                // Perform recursive flattening
                const flattenedItems = this.flattenObjectValue(item.value, item.path);

                flattenedItems.forEach(flatItem => {
                  const dataPath: IPathValueData = {
                    context: context,
                    path: flatItem.path,
                    source: update.$source,
                    timestamp: update.timestamp,
                    value: flatItem.value,
                  };

                  if (update.$source == "defaults" && item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }

                  if (context != this._selfUrn && item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }

                  this._skValue$.next(dataPath);
                });
              } else {
                // Fall back to single-level flattening for objects that exceed limits
                Object.keys(item.value).forEach(key => {
                  const dataPath: IPathValueData = {
                    context: context,
                    path: `${item.path}.${key}`,
                    source: update.$source,
                    timestamp: update.timestamp,
                    value: item.value[key],
                  };

                  if (update.$source == "defaults" && item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }

                  if (context != this._selfUrn && item.path == "") {
                    dataPath.path = dataPath.path.slice(1);
                  }

                  this._skValue$.next(dataPath);
                });
              }
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


  /**
   * Validates if an object can be completely flattened within configured limits.
   * Uses all-or-nothing approach to prevent partial flattening.
   */
  private canFlattenCompletely(obj: unknown, maxDepth: number, maxSize: number, currentDepth = 0): boolean {
    if (currentDepth >= maxDepth) {
      return false;
    }

    if (typeof obj !== 'object' || obj === null) {
      return true;
    }

    const keys = Object.keys(obj);
    if (keys.length > maxSize) {
      return false;
    }

    // Check all nested objects recursively
    for (const key of keys) {
      if (!this.canFlattenCompletely((obj as Record<string, unknown>)[key], maxDepth, maxSize, currentDepth + 1)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Recursively flattens an object into an array of path-value pairs.
   * Only called after validation confirms complete flattening is possible.
   */
  private flattenObjectValue(obj: unknown, basePath: string, currentDepth = 0): {path: string, value: unknown}[] {
    const results: {path: string, value: unknown}[] = [];

    if (typeof obj !== 'object' || obj === null || currentDepth >= this.FLATTEN_CONFIG.maxDepth) {
      return [{ path: basePath, value: obj }];
    }

    const keys = Object.keys(obj);
    for (const key of keys) {
      const newPath = basePath ? `${basePath}.${key}` : key;
      const nestedResults = this.flattenObjectValue((obj as Record<string, unknown>)[key], newPath, currentDepth + 1);
      results.push(...nestedResults);
    }

    return results;
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
