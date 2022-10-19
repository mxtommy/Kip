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
   * Represent SignalK connection's statuses.
   * @usageNotes `operation` field describes the type of operation being
   * performed on the connections.
   * `0 = Never Stated` (app just started),
   * `1 = Connecting to server using Local Config Storage`,
   * `2 = Active connection being reset` (issues on client, server killing client connection or network issue),
   * `3 = App URL Changed` - reconnecting,
   * `4 = adding authorization token to WebSocket`
   */
export interface SignalKStatus {
    server: {
      version: string;
      serverName: string;
    },
    endpoint: {
        status: boolean;
        message: string;
    },
    rest: {
        status: boolean;
        message: string;
    },
    websocket: {
        status: boolean;
        message: string;
        hasToken: boolean;
    },
  operation: number;
}

@Injectable({
  providedIn: 'root'
})
export class SignalKConnectionService {
  // SignalK connections current status initialization
  currentSkStatus: SignalKStatus = {
    server: {
        version: "",
        serverName: ""
    },
    endpoint: {
        status: false,
        message: 'Not yet connected'
    },
    rest: {
        status: false,
        message: 'Not yet connected'
    },
    websocket: {
        status: false,
        message: 'Not yet connected',
        hasToken: false
    },
    operation: 0
  };
  public reset = new Subject<boolean>(); // connection reset
  public signalKStatus: BehaviorSubject<SignalKStatus> = new BehaviorSubject<SignalKStatus>(this.currentSkStatus);

  // Connection information
  public signalKURL: SignalKUrl;
  private authToken: IAuthorizationToken = null;
  private endpointREST: string;
  private endpointWS: string;
  private serverName: string;
  public serverVersion$ = new BehaviorSubject<string>(null);
  private serverRoles: Array<string> = [];

  // REST
  public messageREST$ = new Subject(); //REST Responses

  // Websocket
  private WS_RECONNECT_INTERVAL = 5000;                 // connection error retry interval
  private WS_CONNECTION_ARGUMENT = "?subscribe=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<any>;
  public socketWSCloseEvent = new Subject<CloseEvent>();
  public socketWSOpenEvent = new Subject<Event>();
  private messagesSubjectWS$ = new Subject();
  public messagesWS$ = this.messagesSubjectWS$.pipe(switchAll(), catchError(e => { throw e }));
  //////////////////////////////////////////////////////////////////////////////////////////////////
  //// constructor, mostly sub to stuff for changes.
  constructor(
      private auththeticationService: AuththeticationService,
      private http: HttpClient
    )
  {
    // When token changes, reconnect WebSocket with new token
    this.auththeticationService.authToken$.subscribe((token: IAuthorizationToken) => {
      if (this.authToken != token) {
        this.authToken = token;

        // Only if the socket is all ready up ie. resetSignalk() ran at least once.
        if (this.socketWS$ && this.endpointWS && this.currentSkStatus.websocket.status) {
          this.closeWS();
          this.connectWS();
        }
      }

    });

    // WebSocket Open Event Handling
    this.socketWSOpenEvent.subscribe( event => {
        this.currentSkStatus.websocket.message = "Connected";
        this.currentSkStatus.websocket.status = true;
        this.currentSkStatus.rest.status = true;
        this.currentSkStatus.endpoint.status = true;
        this.signalKStatus.next(this.currentSkStatus);
        if (this.authToken) {
          console.log("[Connection Service] WebSocket connected with Authorization Token")
        } else {
          console.log("[Connection Service] WebSocket connected without Authorization Token");
        }
      }
    );

    // WebSocket closed Event Handling
    this.socketWSCloseEvent.subscribe( event => {
      if(event.wasClean) {
        this.currentSkStatus.websocket.message = "WebSocket closed";
        this.currentSkStatus.websocket.status = false;
        console.log('[Connection Service] WebSocket closed');
        this.signalKStatus.next(this.currentSkStatus);
      } else {
        console.log('[Connection Service] WebSocket terminated due to socket error');
        this.currentSkStatus.websocket.message = "WebSocket terminated";
        this.currentSkStatus.websocket.status = false;
        this.currentSkStatus.endpoint.status = false;
        this.currentSkStatus.rest.status = false;
        this.currentSkStatus.operation = 0;
        //this.closeWS();
        console.log('[Connection Service] WebSocket closed');
        this.signalKStatus.next(this.currentSkStatus);
      }
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

    // TODO check api version... assuming v1
    if (this.signalKURL.new) {
      this.currentSkStatus.operation = 3; // URL Changed
      this.reset.next(true); // emit reset signal (URL changing)

    } else {
      this.currentSkStatus.operation = 1; // Startup connection
    }
    this.currentSkStatus.endpoint.message = "Connecting...";
    this.currentSkStatus.endpoint.status = false;
    this.currentSkStatus.rest.message = "Connecting...";
    this.currentSkStatus.rest.status = false;
    this.signalKStatus.next(this.currentSkStatus);

    let fullURL = this.signalKURL.url;
    let re = new RegExp("signalk/?$");
    if (!re.test(fullURL)) {
        fullURL = fullURL + "/signalk/";
    }

    this.endpointREST = null;
    this.endpointWS = null;
    console.log("[Connection Service] Connecting to: " + this.signalKURL.url);

    await lastValueFrom(this.http.get<SignalKEndpointResponse>(fullURL, {observe: 'response'}))
      .then(response => {
        console.debug("[Connection Service] SignalK HTTP Endpoints retreived");
        this.endpointREST = response.body.endpoints.v1["signalk-http"];
        this.endpointWS = response.body.endpoints.v1["signalk-ws"];

        this.currentSkStatus.endpoint.status = true;
        this.currentSkStatus.endpoint.message = response.status.toString();
        this.currentSkStatus.server.version = response.body.server.id + " " + response.body.server.version;


      })
      .catch((err: HttpErrorResponse) => {
        console.error("[Connection Service] HTTP Endpoints request failed");
        if (err.error instanceof Error) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error('[Connection Service] HTTP connection error occurred:', err.error.message);
          } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong,
            console.error(err);
          }
        this.currentSkStatus.endpoint.status = false;
        this.currentSkStatus.endpoint.message = err.message;
        this.currentSkStatus.rest.message = "Connection failed";
        this.currentSkStatus.server.version = "";
        this.signalKStatus.next(this.currentSkStatus);
      });

      if (this.endpointREST) {
        await this.callREST();

        if (this.socketWS$) {
          this.closeWS();
        }
        this.connectWS();

      } else if (this.socketWS$) {
        this.closeWS();
      }
  }

  /**
   * ASync server API function to retreive Full Document
   *
   * @return {*}  {Promise<void>}
   * @memberof SignalKConnectionService
   */
  async callREST(): Promise<void> {
   await lastValueFrom(this.http.get(this.endpointREST, {observe: 'response'}))
      .then( response => {
        this.currentSkStatus.rest.status = true;
        this.currentSkStatus.rest.message = response.status.toString();
        this.messageREST$.next(response.body);
        this.signalKStatus.next(this.currentSkStatus);
        console.log("[Connection Service] SignalK full document retreived");
      })
      .catch((err: HttpErrorResponse) => {
        this.currentSkStatus.rest.status = false;
        this.currentSkStatus.rest.message = "Connection failed"
        this.currentSkStatus.rest.message = err.message;
        this.signalKStatus.next(this.currentSkStatus);
        console.error('[Connection Service] A REST error occurred:', err.message);
      });
  }

  /**
   * Connect WebSocket to server. Endpoint URL end authentification token is
   * taken from configuration
   */
  public connectWS(): void {
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
      this.currentSkStatus.websocket.hasToken = true;
    } else {
      args = this.WS_CONNECTION_ARGUMENT;
      this.currentSkStatus.websocket.hasToken = false;
    }
    return webSocket({
      url: this.endpointWS + args,
      closeObserver: this.socketWSCloseEvent,
      openObserver: this.socketWSOpenEvent
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
    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/" + version + "/"+ name;

    return lastValueFrom(this.http.post<any>(url, data))
      .catch(error => {
        this.handleError(error);
      });
  }

  public getApplicationDataKeys(scope: string, version: number): Promise<void | string[]> {
    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/" + version + "/?keys=true";

    return lastValueFrom(this.http.get<string[]>(url))
      .catch(error => {
        this.handleError(error);
      });
  }

  public getApplicationData(scope: string, version: number, name: string): Promise<any> {
    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
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
  getSignalKConnectionsStatus() {
    return this.signalKStatus.asObservable();
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
