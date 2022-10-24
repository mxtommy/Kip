import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, lastValueFrom } from 'rxjs';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';

import { ISignalKUrl, IConnectionConfig} from './app-settings.interfaces';

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
 */
export interface IEndpointStatus {
  operation: Number;
  message: string;
  serverDescrption: string;
  httpServiceUrl: string;
  WsServiceUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignalKConnectionService {

  // SignalK connections status initialization
  public serverServiceEndpoints: IEndpointStatus = {
    operation: 0,
    message: "Not connected",
    serverDescrption: null,
    httpServiceUrl: null,
    WsServiceUrl: null,
  };
  public serverServiceEndpoint$: Subject<IEndpointStatus> = new Subject<IEndpointStatus>();

  // Connection information
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
    // load connectionConfig pre AppSettings service instanciation
    let config :IConnectionConfig = JSON.parse(localStorage.getItem("connectionConfig"));
    if (config.signalKUrl) {
      let url: ISignalKUrl = {url: config.signalKUrl, new: false};
      this.resetSignalK(url);
    }
  }

  /**
   * Server API function to retreive server endpoints. Required before
   * making any HTTP calls.
   *
   * @return {*}  {Promise<void>}
   * @memberof SignalKConnectionService
   */
  resetSignalK(skUrl: ISignalKUrl): Promise<void> {
    if (skUrl.url === null) {
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

    console.log("[Connection Service] Connecting to: " + this.signalKURL.url);

    lastValueFrom(this.http.get<ISignalKEndpointResponse>(fullURL, {observe: 'response'}))
      .then((response: HttpResponse<ISignalKEndpointResponse>) => {
        console.debug("[Connection Service] SignalK HTTP Endpoints retreived");
        this.serverServiceEndpoints.httpServiceUrl = response.body.endpoints.v1["signalk-http"];
        this.serverServiceEndpoints.WsServiceUrl = response.body.endpoints.v1["signalk-ws"];

        this.serverServiceEndpoints.operation = 2;
        this.serverServiceEndpoints.message = response.status.toString();
        this.serverServiceEndpoints.serverDescrption = response.body.server.id + " " + response.body.server.version;
        this.serverServiceEndpoint$.next(this.serverServiceEndpoints);
      })
      .catch((err: HttpErrorResponse) => {
        console.error("[Connection Service] HTTP Endpoints request failed");
        if (err.error instanceof Error) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error('[Connection Service] HTTP Endpoint connection error occurred:', err.error.message);
          } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong,
            console.error(err);
          }
        this.serverServiceEndpoints.operation = 3;
        this.serverServiceEndpoints.message = err.message;
        this.serverServiceEndpoints.serverDescrption = null;
        this.serverServiceEndpoint$.next(this.serverServiceEndpoints);
      });
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('[Connection Service] An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(`[Connection Service] Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
    throw error;
  }

  // SignalK Connections Status observable
  getServiceEndpointStatusAsO() {
    return this.serverServiceEndpoint$.asObservable();
  }

  public setServerInfo(name : string, version: string, roles: Array<string>) {
    this.serverName = name;
    this.serverVersion$.next(version);
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
