import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, catchError, lastValueFrom, throwError, timeout } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ISignalKUrl } from '../interfaces/app-settings.interfaces';
import { ConnectionStateMachine } from './connection-state-machine.service';

interface ISignalKEndpointResponse {
    endpoints: {
        v1: {
            version: string;
            "signalk-http"?: string;
            "signalk-ws"?: string;
            "signalk-tcp"?: string;
        }
    }
    server: {
        id: string;
        version: string;
    }
}

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
export interface IEndpointStatus {
  operation: number;
  message: string;
  serverDescription: string;
  httpServiceUrl: string;
  WsServiceUrl: string;
  subscribeAll?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SignalKConnectionService {
  private readonly TIMEOUT_DURATION = 10000;
  private connectionStateMachine = inject(ConnectionStateMachine);

  constructor() {
    // Register HTTP retry callback with the ConnectionStateMachine
    this.connectionStateMachine.setHTTPRetryCallback(() => {
      console.log('[SignalKConnectionService] Executing HTTP retry via callback');
      this.retryCurrentConnection();
    });
  }

  public serverServiceEndpoint$: BehaviorSubject<IEndpointStatus> = new BehaviorSubject<IEndpointStatus>({
    operation: 0,
    message: "Not connected",
    serverDescription: null,
    httpServiceUrl: null,
    WsServiceUrl: null,
  });

  // Server information
  public signalKURL: ISignalKUrl;
  private serverName: string;
  public serverVersion$ = new BehaviorSubject<string>(null);
  private serverRoles: string[] = [];
  private http = inject(HttpClient);

  // Store current connection parameters for retries
  private currentProxyEnabled?: boolean;
  private currentSubscribeAll?: boolean;

  /**
   * Validates if a Signal K server is reachable at the given URL.
   * This is a lightweight check that only verifies HTTP connectivity
   * without storing any configuration or affecting the current connection.
   *
   * @param {string} url - The Signal K server URL to validate.
   * @return {Promise<void>} - A promise that resolves if valid, rejects with error if invalid.
   * @memberof SignalKConnectionService
   */
  public async validateSignalKUrl(url: string): Promise<void> {
    if (!url) {
      throw new Error("Please enter a server URL");
    }

    // Basic URL format validation
    try {
      const urlObject = new URL(url);
      if (!['http:', 'https:'].includes(urlObject.protocol)) {
        throw new Error("URL must start with http:// or https://");
      }
    } catch {
      throw new Error("Invalid URL format - please check for typos and ensure it starts with http:// or https://");
    }

    let fullURL = url;
    if (!fullURL.endsWith("signalk/")) {
      fullURL += "/signalk/";
    }

    console.log(`[Connection Service] Validating Signal K server at: ${url}`);

    try {
      const validationResponse = await lastValueFrom(
        this.http.get<ISignalKEndpointResponse>(fullURL, {observe: 'response'}).pipe(
          timeout(5000), // 5 second timeout for validation
          catchError(err => {
            console.error('[Connection Service] HTTP Error details:', err);

            if (err.name === 'TimeoutError') {
              console.error('[Connection Service] Validation timed out after 5000ms');
              throw new Error(`Server is not responding - check if the URL is correct and the server is running`);
            } else if (err.status === 0 || err.status === undefined) {
              // Network error, CORS, or invalid URL
              throw new Error(`Cannot connect to server - check the URL format and ensure the server is accessible`);
            } else if (err.status === 404) {
              throw new Error(`Server found but no Signal K service detected - verify this is a Signal K server`);
            } else if (err.status === 403) {
              throw new Error(`Server refused connection - check if the server allows connections from this browser`);
            } else if (err.status >= 500) {
              throw new Error(`Server error (${err.status}) - the Signal K server may be having issues`);
            } else {
              throw new Error(`Connection failed (${err.status}) - ${err.statusText || 'please check the server URL'}`);
            }
          })
        )
      );

      // Basic validation that this looks like a Signal K server
      if (!validationResponse.body?.endpoints?.v1) {
        throw new Error(`Server responded but doesn't appear to be a Signal K server - missing required endpoints`);
      }

      console.log(`[Connection Service] Validation successful for: ${url}`);
    } catch (error) {
      console.error(`[Connection Service] Validation failed for ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Initializes the Signal K connection by establishing a new connection to the
   * Signal K server URL, retrieving the server's endpoint information, and
   * starting the HTTP discovery process.
   *
   * @param {ISignalKUrl} skUrl - The Signal K server URL object.
   * @param {boolean} [proxyEnabled] - Optional flag to enable proxy mode.
   * @param {boolean} [subscribeAll] - Optional flag to subscribe to all Delta messages.
   * @return {Promise<void>} - A promise that resolves when the operation is complete.
   * @memberof SignalKConnectionService
   */
  public async initializeConnection(skUrl: ISignalKUrl, proxyEnabled?: boolean, subscribeAll?: boolean): Promise<void> {
    if (!skUrl.url) {
      console.log("[Connection Service] Connection initialization called with null or empty URL value");
      return;
    }

    // Store parameters for potential retries
    this.currentProxyEnabled = proxyEnabled;
    this.currentSubscribeAll = subscribeAll;

    const serverServiceEndpoints: IEndpointStatus = {
      operation: 1,
      message: "Connecting...",
      serverDescription: null,
      httpServiceUrl: null,
      WsServiceUrl: null,
    };

    this.signalKURL = skUrl;
    this.serverServiceEndpoint$.next(serverServiceEndpoints);

    // Notify ConnectionStateMachine that HTTP discovery is starting
    this.connectionStateMachine.startHTTPDiscovery(`Connecting to ${skUrl.url}`);

    let fullURL = this.signalKURL.url;
    if (!fullURL.endsWith("signalk/")) {
      fullURL += "/signalk/";
    }

    try {
      console.log("[Connection Service] Connecting to: " + this.signalKURL.url);
      const endpointResponse = await lastValueFrom(
        this.http.get<ISignalKEndpointResponse>(fullURL, {observe: 'response'}).pipe(
          timeout(this.TIMEOUT_DURATION),
          catchError(err => {
            if (err.name === 'TimeoutError') {
              console.error('[Connection Service] Connection request timed out after ' + this.TIMEOUT_DURATION + 'ms');
            }
            return throwError(err);
          })
        )
      );

      // Process the endpoint response to configure URLs
      Object.assign(serverServiceEndpoints, this.processEndpointResponse(endpointResponse, proxyEnabled, subscribeAll));

      // Notify ConnectionStateMachine of HTTP success
      this.connectionStateMachine.onHTTPDiscoverySuccess();

    } catch (error) {
      serverServiceEndpoints.operation = 3;
      serverServiceEndpoints.message = error.message;

      // Notify ConnectionStateMachine of HTTP failure
      this.connectionStateMachine.onHTTPDiscoveryError(error.message);

      this.handleError(error);
    } finally {
      serverServiceEndpoints.subscribeAll = !!subscribeAll;
      this.serverServiceEndpoint$.next(serverServiceEndpoints);
    }
  }

  /**
   * Retry the current connection using stored parameters
   */
  private retryCurrentConnection(): void {
    if (!this.signalKURL?.url) {
      console.error('[SignalKConnectionService] Cannot retry - no current URL stored');
      return;
    }

    console.log(`[SignalKConnectionService] Retrying connection to ${this.signalKURL.url}`);
    // Perform only the HTTP request part without affecting retry count
    this.performHTTPDiscovery();
  }

  /**
   * Perform the actual HTTP discovery without affecting ConnectionStateMachine state
   */
  private async performHTTPDiscovery(): Promise<void> {
    if (!this.signalKURL?.url) {
      console.error('[SignalKConnectionService] No URL available for HTTP discovery');
      return;
    }

    let fullURL = this.signalKURL.url;
    if (!fullURL.endsWith("signalk/")) {
      fullURL += "/signalk/";
    }

    try {
      console.log("[Connection Service] Connecting to: " + this.signalKURL.url);
      const endpointResponse = await lastValueFrom(
        this.http.get<ISignalKEndpointResponse>(fullURL, {observe: 'response'}).pipe(
          timeout(this.TIMEOUT_DURATION),
          catchError(err => {
            if (err.name === 'TimeoutError') {
              console.error('[Connection Service] Connection request timed out after ' + this.TIMEOUT_DURATION + 'ms');
            }
            return throwError(err);
          })
        )
      );

      // Process the endpoint response to configure URLs
      const serverServiceEndpoints = this.processEndpointResponse(endpointResponse, this.currentProxyEnabled, this.currentSubscribeAll);

      // Notify ConnectionStateMachine of success
      this.connectionStateMachine.onHTTPDiscoverySuccess();

      this.serverServiceEndpoint$.next(serverServiceEndpoints);

    } catch (error) {
      const serverServiceEndpoints: IEndpointStatus = {
        operation: 3,
        message: error.message,
        serverDescription: null,
        httpServiceUrl: null,
        WsServiceUrl: null,
      };

      // Notify ConnectionStateMachine of failure
      this.connectionStateMachine.onHTTPDiscoveryError(error.message);

      this.serverServiceEndpoint$.next(serverServiceEndpoints);
      this.handleError(error);
    }
  }

  /**
   * Process Signal K endpoint response and configure HTTP/WebSocket URLs
   * @param endpointResponse - The HTTP response containing endpoint information
   * @param proxyEnabled - Whether proxy mode is enabled
   * @param subscribeAll - Whether to subscribe to all messages
   * @returns Configured endpoint status object
   */
  private processEndpointResponse(
    endpointResponse: { body: ISignalKEndpointResponse; status: number },
    proxyEnabled?: boolean,
    subscribeAll?: boolean
  ): IEndpointStatus {
    console.debug("[Connection Service] Signal K HTTP Endpoints retrieved");
    this.serverVersion$.next(endpointResponse.body.server.version);

    const httpUrl = endpointResponse.body.endpoints.v1["signalk-http"];
    const wsUrl = endpointResponse.body.endpoints.v1["signalk-ws"];

    const serverServiceEndpoints: IEndpointStatus = {
      operation: 2,
      message: endpointResponse.status?.toString() || "Connected",
      serverDescription: `${endpointResponse.body.server.id} ${endpointResponse.body.server.version}`,
      httpServiceUrl: null,
      WsServiceUrl: null,
    };

    if (proxyEnabled) {
      console.debug("[Connection Service] Proxy Mode Enabled");
      serverServiceEndpoints.httpServiceUrl = window.location.origin + new URL(httpUrl).pathname;
      serverServiceEndpoints.WsServiceUrl = window.location.protocol.replace('http', 'ws') + '//' + window.location.host + new URL(wsUrl).pathname;
    } else {
      serverServiceEndpoints.httpServiceUrl = httpUrl;
      // Only override ws:// to wss:// when page is HTTPS, otherwise keep original
      const isHttpsPage = window.location.protocol === 'https:';
      serverServiceEndpoints.WsServiceUrl = isHttpsPage ? wsUrl.replace('ws://', 'wss://') : wsUrl;
    }

    console.debug("[Connection Service] HTTP URI: " + serverServiceEndpoints.httpServiceUrl);
    console.debug("[Connection Service] WebSocket URI: " + serverServiceEndpoints.WsServiceUrl);

    serverServiceEndpoints.subscribeAll = !!subscribeAll;
    return serverServiceEndpoints;
  }

  private handleError(error: HttpErrorResponse): never {
    const errorMessage = error.status === 0
      ? `[Connection Service] ${error.name}: ${error.message}`
      : `[Connection Service] Backend returned code ${error.status}, body was: ${error.error}`;

    console.error(errorMessage);
    throw error;
  }

  // Endpoint status and address observable
  public getServiceEndpointStatusAsO() {
    return this.serverServiceEndpoint$.asObservable();
  }

  public setServerInfo(name: string, version: string, roles: string[]): void {
    this.serverName = name;
    this.serverRoles = roles;
    console.log(`[Connection Service] Server Name: ${name}, Version: ${version}, Roles: ${JSON.stringify(roles)}`);
  }

  public get skServerName() : string {
    return this.serverName;
  }

  public get skServerVersion() : string {
    return this.serverVersion$.getValue();
  }

  public get skServerRoles() : string[] {
    return this.serverRoles;
  }
}
