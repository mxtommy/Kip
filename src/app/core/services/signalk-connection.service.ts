import { Injectable } from '@angular/core';
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
  operation: Number;
  message: string;
  serverDescription: string;
  httpServiceUrl: string;
  WsServiceUrl: string;
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
  private serverRoles: Array<string> = [];

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //// constructor, mostly sub to stuff for changes.
  constructor(
      private http: HttpClient
    )
  {
  }

  /**
   * Retrieves and publishes target server information and supported service
   * endpoint addresses.
   *
   * @UsageNote Resetting connection is a trigger for many
   * services & components (Delta, Signalk-Settings, etc.).
   *
   * @return {*}  {Promise<void>}
   * @memberof SignalKConnectionService
   */
  public async resetSignalK(skUrl: ISignalKUrl, proxyEnabled?: boolean): Promise<void> {
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

  public setServerInfo(name: string, version: string, roles: Array<string>): void {
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

  public get skServerRoles() : Array<string> {
    return this.serverRoles;
  }
}
