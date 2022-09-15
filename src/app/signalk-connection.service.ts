import { Injectable } from '@angular/core';
import { of , Observable , BehaviorSubject, Subject } from 'rxjs';
import { catchError, tap, switchAll, retryWhen, delay } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { AppSettingsService, SignalKToken, SignalKUrl } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { SignalKFullService } from './signalk-full.service';
import { NotificationsService } from './notifications.service';

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
   * `1 = Connecting to server`,
   * `2 = Active connection being reset` (issues on client, server killing client connection or network issue),
   * `3 = App URL Changed` - reconnecting,
   * `4 = adding authorization token to WebSock`
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

  signalKStatus: BehaviorSubject<SignalKStatus> = new BehaviorSubject<SignalKStatus>(this.currentSkStatus);

  // Main URL Variables
  signalKURL: SignalKUrl;
  signalKToken: SignalKToken;
  endpointREST: string;
  endpointWS: string;

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
    //delete
      private signalKService: SignalKService,
      private signalKFullService: SignalKFullService,
      private appSettingsService: AppSettingsService,
      private notificationsService: NotificationsService,
      private http: HttpClient,
    )
  {

    // when signalKUrl changes, do stuff
    this.appSettingsService.getSignalKURLAsO().subscribe(
      newURL => {
        this.signalKURL = newURL;

        if (this.signalKURL.new) {
          this.currentSkStatus.operation = 3; // URL Changed
          if (this.signalKToken.isSessionToken) {
            //had a previous user token but have new URL. Flush with forced Expired token and relogin required
            this.appSettingsService.setSignalKToken({token: null, isNew: true, isSessionToken: true, isExpired: true});
          }
          this.resetSignalK();
        } else {
          this.currentSkStatus.operation = 1; // Startup connection
          this.resetSignalK();
        }
      }
    );

    // when token changes, do stuff
    this.appSettingsService.getSignalKTokenAsO().subscribe(
      newToken => {
        this.signalKToken = newToken;

        if (this.currentSkStatus.websocket.hasToken == true) {
          if (this.signalKToken.isNew) {
            this.currentSkStatus.operation = 4; // Token update
            console.log("[Connection Service] Replacing WebSocket Security Token");
            this.closeWS();
          } else if (this.signalKToken.isExpired && this.signalKToken.isSessionToken) {
              console.log("[Connection Service] User Security Token expired. Renewing WebSocket");
              this.closeWS();
            } else {
              this.currentSkStatus.operation = 1; // Startup connection
              console.log("[Connection Service] Deleting WebSocket Security Token");
              this.closeWS();
          }
        } else { //no prior token present on WebSocket
          if (this.signalKToken.token == null ) {
            this.currentSkStatus.operation = 1; // Startup connection
          } else {
            if (this.signalKToken.isNew) {
              this.currentSkStatus.operation = 4; // Token update
              console.log("[Connection Service] Adding Security Token to WebSocket");
              this.closeWS();
            } else {
              this.currentSkStatus.operation = 1; // Startup connection
              console.log("[Connection Service] Loading Config Security Token to WebSocket");
            }
          }
        }
      }
    );

    this.socketWSOpenEvent.subscribe( event => {
        this.currentSkStatus.websocket.message = "Connected";
        this.currentSkStatus.websocket.status = true;
        this.currentSkStatus.rest.status = true;
        this.currentSkStatus.endpoint.status = true;
        this.signalKStatus.next(this.currentSkStatus);
        console.log("[Connection Service] WebSocket Connected")
      }
    );

    // WebSocket closure handling
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

  resetSignalK() {
    // TODO check api version... assuming v1
    this.currentSkStatus.endpoint.message = "Connecting...";
    this.currentSkStatus.endpoint.status = false;
    this.currentSkStatus.rest.message = "Connecting...";
    this.currentSkStatus.rest.status = false;
    // WebSocket status handled by SignalkDelta service
    this.signalKStatus.next(this.currentSkStatus);

    this.notificationsService.resetAlarms();

    let fullURL = this.signalKURL.url;
    let re = new RegExp("signalk/?$");
    if (!re.test(fullURL)) {
        fullURL = fullURL + "/signalk/";
    }

    this.endpointREST = null;
    this.endpointWS = null;
    console.log("[Connection Service] Connecting to: " + this.signalKURL.url);
    this.http.get<SignalKEndpointResponse>(fullURL, {observe: 'response'}).subscribe(
      // http endpoint connection
      response => {
        console.debug("[Connection Service] HTTP Connection successful");
        this.endpointREST = response.body.endpoints.v1["signalk-http"];
        this.endpointWS = response.body.endpoints.v1["signalk-ws"];

        this.currentSkStatus.endpoint.status = true;
        this.currentSkStatus.endpoint.message = response.status.toString();
        this.currentSkStatus.server.version = response.body.server.id + " " + response.body.server.version;

        this.callREST();
        // WebSocket handled by SignalkDelta service
        this.signalKStatus.next(this.currentSkStatus);
      },
      // When not ok, this runs...
      (err: HttpErrorResponse) => {
        console.debug("[Connection Service] Connection failed");
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
      }
    );
  }

  callREST() {
      this.http.get(this.endpointREST, {observe: 'response'}).subscribe(
          // when we go ok, this runs
          response => {
            this.currentSkStatus.rest.status = true;
            this.currentSkStatus.rest.message = response.status.toString();
            this.signalKFullService.processFullUpdate(response.body);
          },
          // When not ok, this runs...
          (err: HttpErrorResponse) => {
            this.currentSkStatus.rest.status = false;
            this.currentSkStatus.rest.message = "Connection failed"
            if (err.error instanceof Error) {
              // A client-side or network error occurred. Handle it accordingly.
              this.currentSkStatus.rest.message = err.error.message;
              console.error('[Connection Service] A REST error occurred:', err.error.message);
            } else {
                // The backend returned an unsuccessful response code.
                // The response body may contain clues as to what went wrong,
                this.currentSkStatus.rest.message = "Unspecified REST error";
                console.error(err);
            }
          }
      );
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
    if (this.signalKToken.token != null && this.signalKToken.token != "") {
      args = this.WS_CONNECTION_ARGUMENT + "&token=" + this.signalKToken.token;
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

  postApplicationData(scope: string, configName: string, data: Object): Observable<string[]> {

    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/1.0/"+ configName;

    let options = {};

    if ((this.signalKToken.token !== null)&&(this.signalKToken.token != "")) {
      options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken.token);
    }
    return this.http.post<any>(url, data, options).pipe(
      catchError(this.handleError<string[]>('postApplicationData', []))
    );

  }

  getApplicationDataKeys(scope: string): Observable<string[]> {
    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/1.0/?keys=true";

    let options = {};

    if ((this.signalKToken.token !== null)&&(this.signalKToken.token != "")) {
      options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken.token);
    }

    return this.http.get<string[]>(url, options).pipe(
      tap(_ => {
        console.log("Server Stored Configs for "+ scope +": "); console.log(_)
      }),
      catchError(this.handleError<string[]>('getApplicationDataKeys', []))
    );

  }

  getApplicationData(scope: string, configName: string): Observable<any>{
    let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
    url += "applicationData/" + scope +"/kip/1.0/" + configName;
    let options = {};

    if ((this.signalKToken.token !== null) && (this.signalKToken.token != "")) {
      options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken.token);
    }
    return this.http.get<any>(url, options).pipe(
      tap(_ => {
        console.log("Fetched Stored Configs for "+ scope +" / "+ configName);
      }),
      catchError(this.handleError<any>('getApplicationData'))
    );
  }
  /**
   * Handle Http operation that failed.
   * Let the app continue.
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      console.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  // SignalK Connections Status observable
  getSignalKConnectionsStatus() {
    return this.signalKStatus.asObservable();
  }

  OnDestroy() {
    this.closeWS();
  }

}
