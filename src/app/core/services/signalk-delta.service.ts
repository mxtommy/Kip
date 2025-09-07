import { DestroyRef, inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, fromEvent } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { ISignalKDataValueUpdate, ISignalKDeltaMessage, ISignalKMeta, ISignalKUpdateMessage } from '../interfaces/signalk-interfaces';
import { IMeta, IPathValueData } from "../interfaces/app-interfaces";
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service'
import { AuthenticationService, IAuthorizationToken } from './authentication.service';
import { ConnectionStateMachine, ConnectionState } from './connection-state-machine.service';
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
  private readonly WS_CONNECTION_SUBSCRIBE = "?subscribe=";
  private readonly WS_CONNECTION_META = "&sendMeta=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<object>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();

  // Token
  private authToken: IAuthorizationToken = null;

  private server = inject(SignalKConnectionService);
  private auth = inject(AuthenticationService);
  private connectionStateMachine = inject(ConnectionStateMachine);
  private zones = inject(NgZone); // NgZone to run outside Angular zone - NOT to be confused with SK zones

  // Object flattening configuration - conservative settings for performance
  private readonly FLATTEN_CONFIG = {
    maxDepth: 3,        // Object recursive depth limit
    maxObjectSize: 20,  // Object number of property limit
    enableFlattening: true // Enable or disable recursive flattening of objects
  };
  private readonly DO_NOT_FLATTEN_PATHS = [  // StartWith paths fragment to exclude from flattening
    'displays.',
  ];

  constructor() {
    // Register WebSocket retry callback with ConnectionStateMachine
    this.connectionStateMachine.setWebSocketRetryCallback(() => {
      console.log('[Delta Service] Executing WebSocket retry via callback');
      this.retryWebSocketConnection();
    });

    // Monitor Connection Service Endpoint Status for WebSocket URL
    this.server.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((endpointStatus: IEndpointStatus) => {
        if (endpointStatus.operation === 2) {
          this.endpointWS = endpointStatus.WsServiceUrl;

          // Set subscription type
          if (endpointStatus.subscribeAll) {
            this.SubscriptionType = "all";
          } else {
            this.SubscriptionType = "self";
          }
        }
      });

    // Monitor ConnectionStateMachine state changes
    this.connectionStateMachine.state$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((state: ConnectionState) => {
        switch (state) {
          case ConnectionState.WebSocketConnecting:
            this.handleWebSocketConnecting();
            break;
          case ConnectionState.Connected:
            // Connection handled by WebSocket open event
            break;
          case ConnectionState.Disconnected:
          case ConnectionState.WebSocketError:
          case ConnectionState.PermanentFailure:
            this.handleDisconnection();
            break;
        }
      });

    // Monitor Token changes
    this.auth.authToken$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((token: IAuthorizationToken) => {
        if (this.authToken != token) {
          this.authToken = token;

          // If WebSocket is connected, reconnect with new token
          if (this.socketWS$ && this.connectionStateMachine.isFullyConnected()) {
            this.closeWS('Token changed');
            this.connectionStateMachine.startWebSocketConnection();
          }
        }
      });

    // WebSocket Open Event Handling
    this.socketWSOpenEvent$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this.streamEndpoint.message = "Connected";
        this.streamEndpoint.operation = 2;
        if (this.authToken) {
          console.log("[Delta Service] WebSocket connected with Authorization Token")
        } else {
          console.log("[Delta Service] WebSocket connected without Authorization Token");
        }
        this.streamEndpoint$.next(this.streamEndpoint);

        // Notify ConnectionStateMachine of successful WebSocket connection
        this.connectionStateMachine.onWebSocketConnected();
      });

    // WebSocket closed Event Handling
    this.socketWSCloseEvent$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(event => {
        if (event.wasClean) {
          console.log('[Delta Service] WebSocket closed cleanly');
          this.streamEndpoint.message = "WebSocket closed";
          this.streamEndpoint.operation = 0;
        } else {
          console.log('[Delta Service] WebSocket terminated due to socket error');
          this.streamEndpoint.message = "WebSocket error";
          this.streamEndpoint.operation = 3;

          // Notify ConnectionStateMachine of WebSocket error
          this.connectionStateMachine.onWebSocketError('WebSocket connection lost');
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
   * Connect WebSocket to server. Called by ConnectionStateMachine.
   * No retry logic - that's handled by ConnectionStateMachine.
   */
  public connectWS(reason: string): void {
    this.streamEndpoint.message = "Connecting";
    this.streamEndpoint.operation = 1;
    console.log(`[Delta Service] ${reason}: WebSocket opening...`);
    this.streamEndpoint$.next(this.streamEndpoint);

    this.socketWS$ = this.getNewWebSocket();

    // Running outside Angular's zone to prevent unnecessary change detection cycles
    this.zones.runOutsideAngular(() => {
      this.socketWS$.pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe({
          next: msgWS => this.processWebsocketMessage(msgWS),
          error: err => {
            console.error('[Delta Service] WebSocket error:', err);
            // Note: ConnectionStateMachine error reporting is handled in the close event handler
            // to avoid duplicate error reports for the same connection failure
          }
        });
    });
  }

  /**
   * Retry WebSocket connection without changing ConnectionStateMachine state
   */
  private retryWebSocketConnection(): void {
    console.log('[Delta Service] Retrying WebSocket connection');
    if (!this.endpointWS) {
      console.warn('[Delta Service] No WebSocket endpoint available for retry');
      this.connectionStateMachine.onWebSocketError('No WebSocket endpoint available');
      return;
    }

    // Close existing connection if any
    if (this.socketWS$) {
      this.closeWS('Retrying connection');
    }

    // Start new WebSocket connection
    this.connectWS('WebSocket retry attempt');
  }

  private handleWebSocketConnecting(): void {
    if (!this.endpointWS) {
      console.warn('[Delta Service] No WebSocket endpoint available');
      this.connectionStateMachine.onWebSocketError('No WebSocket endpoint available');
      return;
    }

    // Close existing connection if any
    if (this.socketWS$) {
      this.closeWS('Starting new connection');
    }

    // Start new WebSocket connection
    this.connectWS('ConnectionStateMachine request');
  }

  /**
   * Handle disconnection states from ConnectionStateMachine
   */
  private handleDisconnection(): void {
    if (this.socketWS$) {
      this.closeWS('ConnectionStateMachine disconnection');
    }

    this.streamEndpoint.message = "Not connected";
    this.streamEndpoint.operation = 0;
    this.streamEndpoint$.next(this.streamEndpoint);
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
  * available, the message will be dropped. The socket parser will automatically
  * stringify the message.
  *
  * `*** Do not pre-stringify the msg param ***`
  */
  public publishDelta(msg: object): void {
    if (this.socketWS$) {
      console.log("[Delta Service] WebSocket sending message");
      this.socketWS$.next(msg);
    } else {
      console.log("[Delta Service] No WebSocket present to send message - dropping message");
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
              if (this.DO_NOT_FLATTEN_PATHS.some(sub_string => item.path.includes(sub_string))) {
                // Skip flattening, treat as a single value
                const dataPath: IPathValueData = {
                  context: context,
                  path: item.path,
                  source: update.$source,
                  timestamp: update.timestamp,
                  value: item.value,
                };
                this._skValue$.next(dataPath);
              } else if (this.FLATTEN_CONFIG.enableFlattening &&
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
    if (!this.connectionStateMachine.isFullyConnected()) {
      if (this.connectionStateMachine.isHTTPConnected()  && this.connectionStateMachine.currentState !== ConnectionState.WebSocketRetrying) {
        console.log(`[Delta Service] ${reason}: WebSocket disconnected, requesting reconnection...`);
        this.connectionStateMachine.startWebSocketConnection();
      } else {
        console.log(`[Delta Service] ${reason}: HTTP not connected, cannot start WebSocket`);
      }
    } else {
      console.log(`[Delta Service] ${reason}: Connection is active.`);
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
  }
}
