import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, lastValueFrom } from 'rxjs';
import { catchError, tap, switchAll, retryWhen, delay } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { SignalKUrl } from './app-settings.service';
import { AuththeticationService , IAuthorizationToken } from './auththetication.service';

interface SignalKEndpointResponse {
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
  operation: number;
  message: string;
  serverDescrption: string;
  httpServiceUrl: string;
  WsServiceUrl: string;
}

export interface IFullDocumentStatus {
  operation: number;
  message: string;
}

export interface IStreamStatus {
  operation: number;
  message: string;
  hasToken: boolean;
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

  public fullDocEndpoint: IFullDocumentStatus = {
    operation: 0,
    message: "Not connected",
  }

  public streamEndpoint: IStreamStatus = {
    operation: 0,
    message: "Not connected",
    hasToken: false,
  }


  public reset = new Subject<boolean>(); // connection reset
  public serverServiceEndpoint$: Subject<IEndpointStatus> = new Subject<IEndpointStatus>();
  public fullDocumentEndpoint$: BehaviorSubject<IFullDocumentStatus> = new BehaviorSubject<IFullDocumentStatus>(this.fullDocEndpoint);
  public streamEndpoint$: BehaviorSubject<IStreamStatus> = new BehaviorSubject<IStreamStatus>(this.streamEndpoint);

  // Connection information
  public signalKURL: SignalKUrl;
  private authToken: IAuthorizationToken = null;
  private serverName: string;
  public serverVersion$ = new BehaviorSubject<string>(null);
  private serverRoles: Array<string> = [];

  // REST
  public messageREST$ = new Subject(); //REST Responses stream

  // Websocket
  private WS_RECONNECT_INTERVAL = 5000;                 // connection error retry interval
  private WS_CONNECTION_ARGUMENT = "?subscribe=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<any>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();
  private messagesSubjectWS$ = new Subject();
  public messagesWS$ = this.messagesSubjectWS$.pipe(switchAll(), catchError(e => { throw e }));
  //////////////////////////////////////////////////////////////////////////////////////////////////
  //// constructor, mostly sub to stuff for changes.
  constructor(
      private auth: AuththeticationService,
      private http: HttpClient
    )
  {

    this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      if (this.authToken != token) { // When token changes, reconnect WebSocket with new token
        this.authToken = token;

        // Only if the socket is all ready up ie. resetSignalk() ran at least once.
        if (this.socketWS$ && (this.streamEndpoint.operation === 2)) {
          this.closeWS();

          setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
            this.connectWS();
          }, 250);
        }
      }

    });

    // WebSocket Open Event Handling
    this.socketWSOpenEvent$.subscribe( event => {
        this.streamEndpoint.message = "Connected";
        this.streamEndpoint.operation = 2;
        if (this.authToken) {
          console.log("[Connection Service] WebSocket connected with Authorization Token")
        } else {
          console.log("[Connection Service] WebSocket connected without Authorization Token");
        }
        this.streamEndpoint$.next(this.streamEndpoint);
      }
    );

    // WebSocket closed Event Handling
    this.socketWSCloseEvent$.subscribe( event => {
      if(event.wasClean) {
        this.streamEndpoint.message = "WebSocket closed";
        this.streamEndpoint.operation = 0;
        console.log('[Connection Service] WebSocket closed');
      } else {
        console.log('[Connection Service] WebSocket terminated due to socket error');
        this.streamEndpoint.message = "WebSocket error";
        this.streamEndpoint.operation = 3;
        console.log('[Connection Service] WebSocket closed');
      }
      this.streamEndpoint$.next(this.streamEndpoint);
    });
  }

  /**
   * ASync server API function to retreive server endpoints. Required before
   * making any HTTP calls.
   *
   * @return {*}  {Promise<void>}
   * @memberof SignalKConnectionService
   */
  async resetSignalK(skUrl: SignalKUrl): Promise<void> {
    if (skUrl.url === null) {
      return;
    }
    this.signalKURL = skUrl;

    if (this.signalKURL.new) {
      this.reset.next(true); // emit reset signal (URL changing)
    }
    this.serverServiceEndpoints.message = "Connecting..."
    this.serverServiceEndpoints.operation = 1;
    this.serverServiceEndpoints.httpServiceUrl = null;
    this.serverServiceEndpoints.WsServiceUrl = null;
    this.serverServiceEndpoint$.next(this.serverServiceEndpoints);

    this.fullDocEndpoint.message = "Connecting...";
    this.fullDocEndpoint.operation = 1;
    this.fullDocumentEndpoint$.next(this.fullDocEndpoint);

    let fullURL = this.signalKURL.url;
    let re = new RegExp("signalk/?$");
    if (!re.test(fullURL)) {
        fullURL = fullURL + "/signalk/";
    }

    console.log("[Connection Service] Connecting to: " + this.signalKURL.url);

    await lastValueFrom(this.http.get<any>(fullURL, {observe: 'response'}))
      .then(response => {
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

      if (this.serverServiceEndpoints.operation === 2) {
        await this.callREST();

        if (this.socketWS$) {
          this.closeWS();
        }

        setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
          this.connectWS();
        }, 250);


      } else {
        this.fullDocEndpoint.operation = 0;
        this.fullDocEndpoint.message = "No connected";
        this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
        console.log('[Connection Service] Full Document endpoint not retreived do to server service endpoint request failure');

        if (this.socketWS$) {
          this.closeWS();
        }
      }
  }

  /**
   * ASync server API function to retreive Full Document
   *
   * @return {*}  {Promise<void>}
   * @memberof SignalKConnectionService
   */
  async callREST(): Promise<void> {

    await lastValueFrom(this.http.get(this.serverServiceEndpoints.httpServiceUrl, {observe: 'response'}))
      .then( response => {
        this.fullDocEndpoint.operation = 2;
        this.fullDocEndpoint.message = response.status.toString();
        this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
        this.messageREST$.next(response.body);
        console.log("[Connection Service] SignalK full document retreived");
      })
      .catch((err: HttpErrorResponse) => {
        this.fullDocEndpoint.operation = 3;
        this.fullDocEndpoint.message = err.message;
        this.fullDocumentEndpoint$.next(this.fullDocEndpoint);
        console.error('[Connection Service] A Full Document endpoint error occurred:', err.message);
      });
}

  /**
   * Connect WebSocket to server. Endpoint URL end authentification token is
   * taken from configuration
   */
  public connectWS(): void {
    this.streamEndpoint.message = "Connecting";
    this.streamEndpoint.operation = 1;
    this.streamEndpoint$.next(this.streamEndpoint);

    this.socketWS$ = this.getNewWebSocket();
    const messagesWS$ = this.socketWS$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => {
            console.error("[Connection Service] WebSocket error: " + JSON.stringify(err, ["code", "message", "type"]))
          }),
          delay(this.WS_RECONNECT_INTERVAL)
        )
      )
    );
    this.messagesSubjectWS$.next(messagesWS$);
  }

  /**
   * Handles connection arguments, token and creates socket Open/Close Observers
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
      url: this.serverServiceEndpoints.WsServiceUrl + args,
      closeObserver: this.socketWSCloseEvent$,
      openObserver: this.socketWSOpenEvent$
    })
  }
  /**
  * Send message to WebSocket recipient
  * @param msg JSON formated message to be sent. If the WebSocket is not
  * available, one retry after 1 sec will be made. The socket parser will automatically
  * stringify the message.
  *
  * `*** Do not pre-stringify the msg param ***`
  */
  public sendMessageWS(msg: any) {
    if (this.socketWS$) {
      console.log("[Connection Service] WebSocket sending message");
      this.socketWS$.next(msg);
    } else {
      setTimeout((): void => {
        console.log("[Connection Service] WebSocket retry sending message");
        this.socketWS$.next(msg);
      }, 1000);
      console.log("[Connection Service] No WebSocket present to send messsage");
    }
  }
  /**
  * Close WebSocket
  */
  public closeWS() {
    if (this.socketWS$) {
      console.log("[Connection Service] WebSocket closing...");
      this.socketWS$.complete();
    }
  }

  public postApplicationData(scope: string, version: number, name: string, data: Object): Promise<any> {
    let url = this.serverServiceEndpoints.httpServiceUrl.substring(0,this.serverServiceEndpoints.httpServiceUrl.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/" + version + "/"+ name;

    return lastValueFrom(this.http.post<any>(url, data))
      .catch(error => {
        this.handleError(error);
      });
  }

  public getApplicationDataKeys(scope: string, version: number): Promise<void | string[]> {
    let url = this.serverServiceEndpoints.httpServiceUrl.substring(0,this.serverServiceEndpoints.httpServiceUrl.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/" + version + "/?keys=true";

    return lastValueFrom(this.http.get<string[]>(url))
      .catch(error => {
        this.handleError(error);
      });
  }

  public getApplicationData(scope: string, version: number, name: string): Promise<any> {
    let url = this.serverServiceEndpoints.httpServiceUrl.substring(0,this.serverServiceEndpoints.httpServiceUrl.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/" + version + "/" + name;

    return lastValueFrom(this.http.get<any>(url))
      .catch(error => {
        this.handleError(error);
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

  // SignalK Connections Status observable
  getFullDocumentStatusAsO() {
    return this.fullDocumentEndpoint$.asObservable();
  }

  // SignalK Connections Status observable
  getDataStreamStatusAsO() {
    return this.streamEndpoint$.asObservable();
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

  OnDestroy() {
    this.closeWS();
  }

}
