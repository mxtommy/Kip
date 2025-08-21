import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Connection state enumeration
 */
export enum ConnectionState {
  Disconnected = 'Disconnected',
  HTTPDiscovering = 'HTTPDiscovering',
  HTTPConnected = 'HTTPConnected',
  HTTPError = 'HTTPError',
  HTTPRetrying = 'HTTPRetrying',
  WebSocketConnecting = 'WebSocketConnecting',
  Connected = 'Connected',
  WebSocketError = 'WebSocketError',
  WebSocketRetrying = 'WebSocketRetrying',
  PermanentFailure = 'PermanentFailure'
}

/**
 * Connection status interface for notifications
 */
export interface IConnectionStatus {
  state: ConnectionState;
  operation: number; // Legacy operation codes for compatibility
  message: string;
  retryCount?: number;
  maxRetries?: number;
  timestamp: Date;
}

/**
 * Connection configuration interface
 */
export interface IConnectionConfig {
  httpRetryCount: number;
  webSocketRetryCount: number;
  retryIntervals: number[];
  notificationDebounceMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConnectionStateMachine implements OnDestroy {
  private readonly config: IConnectionConfig = {
    httpRetryCount: 3,
    webSocketRetryCount: 5,
    retryIntervals: [2000, 3000, 5000], // Exponential backoff: 2s, 3s, 5s
    notificationDebounceMs: 0
  };

  // State management
  private _currentState$ = new BehaviorSubject<ConnectionState>(ConnectionState.Disconnected);
  private _status$ = new BehaviorSubject<IConnectionStatus>(this.createStatus(ConnectionState.Disconnected, 'Not connected'));

  // Retry tracking
  private _httpRetryCount = 0;
  private _webSocketRetryCount = 0;
  private _retryTimeout: NodeJS.Timeout | null = null;
  private _notificationTimeout: NodeJS.Timeout | null = null;

  // Retry callback for HTTP requests
  private _httpRetryCallback: (() => void) | null = null;

  // Retry callback for WebSocket requests
  private _webSocketRetryCallback: (() => void) | null = null;

  // Mode tracking for APP_INITIALIZER compatibility
  private _isInitializationMode = true;

  constructor() {
    console.log('[ConnectionStateMachine] Service initialized');
  }

  /**
   * Get current connection state as observable
   */
  public get state$(): Observable<ConnectionState> {
    return this._currentState$.asObservable();
  }

  /**
   * Get current connection status as observable (for notifications)
   */
  public get status$(): Observable<IConnectionStatus> {
    return this._status$.asObservable();
  }

  /**
   * Get current state value
   */
  public get currentState(): ConnectionState {
    return this._currentState$.getValue();
  }

  /**
   * Enable full functionality after APP_INITIALIZER completes
   */
  public enableWebSocketMode(): void {
    this._isInitializationMode = false;
    console.log('[ConnectionStateMachine] WebSocket mode enabled');

    // Ensure current status is emitted for components that start after initialization
    const currentStatus = this._status$.getValue();
    console.log(`[ConnectionStateMachine] Current status when enabling WebSocket mode: ${currentStatus.state} - ${currentStatus.message}`);
    this._status$.next(currentStatus);
  }

  /**
   * Set the HTTP retry callback function
   */
  public setHTTPRetryCallback(callback: () => void): void {
    this._httpRetryCallback = callback;
  }

  /**
   * Set the WebSocket retry callback function
   */
  public setWebSocketRetryCallback(callback: () => void): void {
    this._webSocketRetryCallback = callback;
  }

  /**
   * Start HTTP discovery process
   */
  public startHTTPDiscovery(reason = 'Connection request'): void {
    console.log(`[ConnectionStateMachine] Starting HTTP discovery: ${reason}`);
    this._httpRetryCount = 0;
    this.setState(ConnectionState.HTTPDiscovering, 'Discovering Signal K server...');
  }

  /**
   * HTTP discovery succeeded
   */
  public onHTTPDiscoverySuccess(): void {
    console.log('[ConnectionStateMachine] HTTP discovery successful');
    this._httpRetryCount = 0;
    this.setState(ConnectionState.HTTPConnected, 'Signal K server discovered');

    // Only proceed to WebSocket if not in initialization mode
    if (!this._isInitializationMode) {
      this.startWebSocketConnection();
    }
  }

  /**
   * HTTP discovery failed
   */
  public onHTTPDiscoveryError(error: string): void {
    console.log(`[ConnectionStateMachine] HTTP discovery failed: ${error}`);

    if (this._httpRetryCount < this.config.httpRetryCount) {
      this._httpRetryCount++;
      this.setState(
        ConnectionState.HTTPRetrying,
        `HTTP connection failed. Retrying (${this._httpRetryCount}/${this.config.httpRetryCount})...`,
        this._httpRetryCount,
        this.config.httpRetryCount
      );
      this.scheduleHTTPRetry();
    } else {
      this.setState(
        ConnectionState.PermanentFailure,
        `HTTP connection failed after ${this.config.httpRetryCount} attempts. Check server URL.`,
        this.config.httpRetryCount,
        this.config.httpRetryCount
      );
    }
  }

  /**
   * Start WebSocket connection (only called after HTTP success and not in init mode)
   */
  public startWebSocketConnection(): void {
    // Allow WebSocket start if HTTP is connected or we're already in WebSocket retry mode
    const canStartWebSocket = this.currentState === ConnectionState.HTTPConnected ||
                             this.currentState === ConnectionState.WebSocketRetrying ||
                             this.currentState === ConnectionState.WebSocketConnecting ||
                             this.currentState === ConnectionState.Connected;

    if (!canStartWebSocket) {
      // If we're still discovering HTTP, this is expected
      if (this.currentState === ConnectionState.HTTPDiscovering) {
        return;
      }

      // For other states, this might be unexpected
      return;
    }

    console.log('[ConnectionStateMachine] Starting WebSocket connection');
    this._webSocketRetryCount = 0;
    this.setState(ConnectionState.WebSocketConnecting, 'Connecting to Signal K Websocket...');
  }

  /**
   * WebSocket connection succeeded
   */
  public onWebSocketConnected(): void {
    console.log('[ConnectionStateMachine] WebSocket connected');
    this._webSocketRetryCount = 0;
    this.setState(ConnectionState.Connected, 'Connected to Signal K server');
  }

  /**
   * WebSocket connection failed
   */
  public onWebSocketError(error: string): void {
    console.log(`[ConnectionStateMachine] WebSocket error: ${error}`);

    // Check if HTTP is still connected
    if (this.currentState !== ConnectionState.HTTPConnected &&
        this.currentState !== ConnectionState.WebSocketConnecting &&
        this.currentState !== ConnectionState.Connected &&
        this.currentState !== ConnectionState.WebSocketRetrying) {
      console.log('[ConnectionStateMachine] HTTP connection lost, restarting HTTP discovery');
      this.startHTTPDiscovery('HTTP connection lost during WebSocket operation');
      return;
    }

    this._webSocketRetryCount++;
    this.setState(
      ConnectionState.WebSocketRetrying,
      `WebSocket connection failed. Retry attempt ${this._webSocketRetryCount}...`,
      this._webSocketRetryCount,
      this.config.webSocketRetryCount
    );
    this.scheduleWebSocketRetry();
  }

  /**
   * Gracefully shutdown all connections before app restart
   */
  public shutdown(reason = 'App shutdown'): void {
    console.log(`[ConnectionStateMachine] Shutting down all connections: ${reason}`);
    this.clearRetryTimer();
    this.clearNotificationTimeout();
    this._httpRetryCount = 0;
    this._webSocketRetryCount = 0;
    // Set to disconnected state to trigger cleanup in dependent services
    this.setState(ConnectionState.Disconnected, 'Application restarting...');
  }

  /**
   * Check if HTTP discovery is complete and successful
   */
  public isHTTPConnected(): boolean {
    return this.currentState === ConnectionState.HTTPConnected ||
           this.currentState === ConnectionState.WebSocketConnecting ||
           this.currentState === ConnectionState.Connected ||
           this.currentState === ConnectionState.WebSocketRetrying;
  }

  /**
   * Check if fully connected (WebSocket active)
   */
  public isFullyConnected(): boolean {
    return this.currentState === ConnectionState.Connected;
  }

  /**
   * Check if currently connected (HTTP or WebSocket)
   */
  private setState(state: ConnectionState, message: string, retryCount?: number, maxRetries?: number): void {
    this._currentState$.next(state);

    const status = this.createStatus(state, message, retryCount, maxRetries);

    // Handle notification timing
    if (state === ConnectionState.HTTPDiscovering || state === ConnectionState.WebSocketConnecting) {
      // Show connecting immediately
      this._status$.next(status);
    } else if (state === ConnectionState.Connected) {
      // Debounce connected status for stability
      this.clearNotificationTimeout();
      this._notificationTimeout = setTimeout(() => {
        this._status$.next(status);
      }, this.config.notificationDebounceMs);
    } else {
      // Show other states immediately
      this.clearNotificationTimeout();
      this._status$.next(status);
    }
  }

  private createStatus(state: ConnectionState, message: string, retryCount?: number, maxRetries?: number): IConnectionStatus {
    return {
      state,
      operation: this.stateToOperationCode(state),
      message,
      retryCount: retryCount || 0,
      maxRetries: maxRetries || 0,
      timestamp: new Date()
    };
  }

  private stateToOperationCode(state: ConnectionState): number {
    switch (state) {
      case ConnectionState.Disconnected:
        return 0;
      case ConnectionState.HTTPDiscovering:
      case ConnectionState.WebSocketConnecting:
        return 1; // Connecting
      case ConnectionState.Connected:
        return 2; // Connected
      case ConnectionState.HTTPError:
      case ConnectionState.WebSocketError:
      case ConnectionState.HTTPRetrying:
      case ConnectionState.WebSocketRetrying:
        return 3; // Error/Retrying
      case ConnectionState.HTTPConnected:
        return 2; // Connected (HTTP level)
      case ConnectionState.PermanentFailure:
        return 5; // Permanent failure
      default:
        return 0;
    }
  }

  private scheduleHTTPRetry(): void {
    this.clearRetryTimer();
    const retryIndex = Math.min(this._httpRetryCount - 1, this.config.retryIntervals.length - 1);
    const delay = this.config.retryIntervals[retryIndex];

    console.log(`[ConnectionStateMachine] Scheduling HTTP retry in ${delay}ms`);
    this._retryTimeout = setTimeout(() => {
      // Trigger the actual HTTP request via callback
      // Don't change state here - let the HTTP result determine the new state
      if (this._httpRetryCallback) {
        console.log(`[ConnectionStateMachine] Executing HTTP retry ${this._httpRetryCount}/${this.config.httpRetryCount}`);
        this._httpRetryCallback();
      } else {
        console.error('[ConnectionStateMachine] No HTTP retry callback set!');
        this.setState(ConnectionState.Disconnected, 'HTTP retry callback not configured');
      }
    }, delay);
  }

  private scheduleWebSocketRetry(): void {
    this.clearRetryTimer();

    console.log(`[ConnectionStateMachine] Scheduling WebSocket retry in ${this.config.retryIntervals[1]}ms`);
    this._retryTimeout = setTimeout(() => {
      // Trigger WebSocket reconnection attempt via callback
      // Don't change state here - let the WebSocket result determine the new state
      if (this._webSocketRetryCallback) {
        console.log(`[ConnectionStateMachine] Executing WebSocket retry ${this._webSocketRetryCount}/${this.config.webSocketRetryCount}`);
        this._webSocketRetryCallback();
      } else {
        // Fallback to the old behavior if no callback is set
        console.log(`[ConnectionStateMachine] No WebSocket retry callback - using state change method`);
        this.setState(
          ConnectionState.WebSocketConnecting,
          `Retrying WebSocket connection (${this._webSocketRetryCount}/${this.config.webSocketRetryCount})...`,
          this._webSocketRetryCount,
          this.config.webSocketRetryCount
        );
      }
    }, this.config.retryIntervals[1]);
  }

  private clearRetryTimer(): void {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
      this._retryTimeout = null;
    }
  }

  private clearNotificationTimeout(): void {
    if (this._notificationTimeout) {
      clearTimeout(this._notificationTimeout);
      this._notificationTimeout = null;
    }
  }

  /**
   * Ensure any scheduled retries / notifications are cancelled when the injector
   * disposes this service (e.g. app shutdown / HMR replacement) to avoid stray
   * callbacks retaining references.
   */
  ngOnDestroy(): void {
    this.clearRetryTimer();
    this.clearNotificationTimeout();
    this._httpRetryCallback = null;
    this._webSocketRetryCallback = null;
    this._currentState$?.complete();
    this._status$?.complete();
  }
}
