import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, catchError, lastValueFrom, throwError, timeout } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ISignalKUrl } from '../interfaces/app-settings.interfaces';

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

  /**
 * Retrieves and publishes target server information and supported service
 * endpoint addresses.
 *
 * This method resets the Signal K connection by connecting to the specified
 * Signal K server URL, retrieving the server's endpoint information, and
 * publishing the server's status and endpoint addresses. It also handles
 * proxy mode if enabled and sets the delta service subscription mode.
 *
 * @UsageNote Resetting the connection is a trigger for many
 * services & components (Delta, Settings, etc.).
 *
 * @param {ISignalKUrl} skUrl - The Signal K server URL object.
 * @param {boolean} [proxyEnabled] - Optional flag to enable proxy mode.
 * @param {boolean} [subscribeAll] - Optional flag to subscribe to all Delta messages. If false, only subscribes to self.*.
 * @return {Promise<void>} - A promise that resolves when the operation is complete.
 * @memberof SignalKConnectionService
 */
  public async resetSignalK(skUrl: ISignalKUrl, proxyEnabled?: boolean, subscribeAll?: boolean): Promise<void> {
    if (!skUrl.url) {
      console.log("[Connection Service] Connection reset called with null or empty URL value");
      return;
    }

    const serverServiceEndpoints: IEndpointStatus = {
      operation: 1,
      message: "Connecting...",
      serverDescription: null,
      httpServiceUrl: null,
      WsServiceUrl: null,
    };

    this.signalKURL = skUrl;
    this.serverServiceEndpoint$.next(serverServiceEndpoints);

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

      console.debug("[Connection Service] Signal K HTTP Endpoints retrieved");
      this.serverVersion$.next(endpointResponse.body.server.version);

      const httpUrl = endpointResponse.body.endpoints.v1["signalk-http"];
      const wsUrl = endpointResponse.body.endpoints.v1["signalk-ws"];

      if (proxyEnabled) {
        console.debug("[Connection Service] Proxy Mode Enabled");
        serverServiceEndpoints.httpServiceUrl = window.location.origin + new URL(httpUrl).pathname;
        serverServiceEndpoints.WsServiceUrl = (window.location.protocol == 'https:' ? 'wss://' : 'ws://') + window.location.host + new URL(wsUrl).pathname;
      } else {
        serverServiceEndpoints.httpServiceUrl = httpUrl;
        serverServiceEndpoints.WsServiceUrl = wsUrl;
      }

      console.debug("[Connection Service] HTTP URI: " + serverServiceEndpoints.httpServiceUrl);
      console.debug("[Connection Service] WebSocket URI: " + serverServiceEndpoints.WsServiceUrl);

      serverServiceEndpoints.operation = 2;
      serverServiceEndpoints.message = endpointResponse.status.toString();
      serverServiceEndpoints.serverDescription = `${endpointResponse.body.server.id} ${endpointResponse.body.server.version}`;
    } catch (error) {
      serverServiceEndpoints.operation = 3;
      serverServiceEndpoints.message = error.message;
      this.handleError(error);
    } finally {
      subscribeAll ? serverServiceEndpoints.subscribeAll = true : serverServiceEndpoints.subscribeAll = false;
      this.serverServiceEndpoint$.next(serverServiceEndpoints);
    }
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
