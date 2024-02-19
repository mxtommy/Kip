import { Injectable } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
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

  // Connections status initialization values for behavior Observer
  public serverServiceEndpoints: IEndpointStatus = {
    operation: 0,
    message: "Not connected",
    serverDescription: null,
    httpServiceUrl: null,
    WsServiceUrl: null,
  };
  public serverServiceEndpoint$: BehaviorSubject<IEndpointStatus> = new BehaviorSubject<IEndpointStatus>(this.serverServiceEndpoints);

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
    if (skUrl.url === null) {
      console.log("[Connection Service] Connection reset called with null or empty URL value");
      return;
    }
    this.signalKURL = skUrl;

    this.serverServiceEndpoints.message = "Connecting..."
    this.serverServiceEndpoints.operation = 1;
    this.serverServiceEndpoints.httpServiceUrl = null;
    this.serverServiceEndpoints.WsServiceUrl = null;
    this.serverServiceEndpoint$.next(this.serverServiceEndpoints);

    let fullURL = this.signalKURL.url;
    let re = new RegExp("signalk/?$");
    if (!re.test(fullURL)) {
        fullURL = fullURL + "/signalk/";
    }

    try {
      console.log("[Connection Service] Connecting to: " + this.signalKURL.url);
      const endpointResponse = await lastValueFrom(this.http.get<ISignalKEndpointResponse>(fullURL, {observe: 'response'}));

      console.debug("[Connection Service] Signal K HTTP Endpoints retrieved");
      this.serverVersion$.next(endpointResponse.body.server.version);

      if (proxyEnabled) {
        console.debug("[Connection Service] Proxy Mode Enabled");
        const skHttpUrl = new URL(endpointResponse.body.endpoints.v1["signalk-http"]);
        const skWsUrl = new URL(endpointResponse.body.endpoints.v1["signalk-ws"]);

        this.serverServiceEndpoints.httpServiceUrl =  window.location.origin + skHttpUrl.pathname;
        console.debug("[Connection Service] Proxy HTTP URI: " +this.serverServiceEndpoints.httpServiceUrl);

        let uri: string = window.location.protocol == 'https:' ? 'wss://' : 'ws://';
        uri += window.location.host;
        uri += skWsUrl.pathname;
        this.serverServiceEndpoints.WsServiceUrl = uri;

        console.debug("[Connection Service] Proxy WebSocket URI: " + this.serverServiceEndpoints.WsServiceUrl);
      } else {
        this.serverServiceEndpoints.httpServiceUrl = endpointResponse.body.endpoints.v1["signalk-http"];
        console.debug("[Connection Service] HTTP URI: " +this.serverServiceEndpoints.httpServiceUrl);
        this.serverServiceEndpoints.WsServiceUrl = endpointResponse.body.endpoints.v1["signalk-ws"];
        console.debug("[Connection Service] WebSocket URI: " + this.serverServiceEndpoints.WsServiceUrl);
      }

      this.serverServiceEndpoints.operation = 2;
      this.serverServiceEndpoints.message = endpointResponse.status.toString();
      this.serverServiceEndpoints.serverDescription = endpointResponse.body.server.id + " " + endpointResponse.body.server.version;
    } catch (error) {
      this.serverServiceEndpoints.operation = 3;
      this.serverServiceEndpoints.message = error.message;
      this.serverServiceEndpoints.serverDescription = null;
      this.handleError(error);
    } finally {
      this.serverServiceEndpoint$.next(this.serverServiceEndpoints);
    }
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly
      console.error(`[Connection Service] ${error.name}: ${error.message}`);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(`[Connection Service] Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
    throw error;
  }

  // Endpoint status and address observable
  public getServiceEndpointStatusAsO() {
    return this.serverServiceEndpoint$.asObservable();
  }

  public setServerInfo(name : string, version: string, roles: Array<string>) {
    this.serverName = name;
    this.serverRoles = roles;
    console.log("[Connection Service] Server Name: " + name + ", Version: " + version + ", Roles: " + JSON.stringify(roles));
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
