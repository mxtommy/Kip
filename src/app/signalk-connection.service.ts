import { Injectable } from '@angular/core';
import { of , Observable , BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { AppSettingsService, SignalKToken, SignalKUrl } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { SignalKDeltaService } from './signalk-delta.service';
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
   * `4 = adding R/W authorization token to WebSock`
   */
export interface SignalKStatus {
    server: {
      version: string;
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
    },
  operation: number;
}

@Injectable()
export class SignalKConnectionService {

    // Main URL Variables
    signalKURL: SignalKUrl;
    signalKToken: SignalKToken;
    endpointREST: string;
    endpointWS: string;

    // Websocket
    webSocket: WebSocket = null;

    // SignalK connections current status initialization
    currentSkStatus: SignalKStatus = {
      server: {
          version: "",
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
          message: 'Not yet connected'
      },
      operation: 0
    };

    signalKStatus: BehaviorSubject<SignalKStatus> = new BehaviorSubject<SignalKStatus>(this.currentSkStatus);

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //// constructor, mostly sub to stuff for changes.
    constructor(
        private signalKService: SignalKService,
        private signalKDeltaService: SignalKDeltaService,
        private SignalKFullService: SignalKFullService,
        private appSettingsService: AppSettingsService,
        private notificationsService: NotificationsService,
        private http: HttpClient)
    {
        // when signalKUrl changes, do stuff
        this.appSettingsService.getSignalKURLAsO().subscribe(
          newURL => {
            this.signalKURL = newURL;

            if (this.signalKURL.new) {
              this.currentSkStatus.operation = 3; // URL Changed
              this.resetSignalK();
            } else {
              this.currentSkStatus.operation = 1; // Startup connection
            }
          }
        );
        // when token changes, do stuff
        this.appSettingsService.getSignalKTokenAsO().subscribe(
          newToken => {
            this.signalKToken = newToken;

            if (this.signalKToken.new) {
              this.currentSkStatus.operation = 4; // Token update
              this.resetSignalK();
            } else {
              this.currentSkStatus.operation = 1; // Token update
              this.resetSignalK();
            }
          }
        );
    }

    resetSignalK() {
      // TODO close current connections/reset data, check api version... assuming v1
      console.debug("Resting URL: " + this.signalKURL.url);

      // clean close if open
      if (this.webSocket != null && this.webSocket.OPEN) {
        this.webSocket.close();
      }

      this.currentSkStatus.endpoint.message = "Connecting...";
      this.currentSkStatus.endpoint.status = false;
      this.currentSkStatus.rest.message = "Connecting...";
      this.currentSkStatus.rest.status = false;
      this.currentSkStatus.websocket.message = "Connecting...";
      this.currentSkStatus.websocket.status = false;
      this.signalKStatus.next(this.currentSkStatus);

      this.notificationsService.resetAlarms();

      let fullURL = this.signalKURL.url;
      let re = new RegExp("signalk/?$");
      if (!re.test(fullURL)) {
          fullURL = fullURL + "/signalk/";
      }

      // this.signalKDeltaService.resetSignalKData(); // can't find this in our code.
      this.endpointREST = null;
      this.endpointWS = null;

      this.http.get<SignalKEndpointResponse>(fullURL, {observe: 'response'}).subscribe(
        // when we go ok, this runs
        response => {
          this.endpointREST = response.body.endpoints.v1["signalk-http"];
          this.endpointWS = response.body.endpoints.v1["signalk-ws"];

          this.currentSkStatus.endpoint.status = true;
          this.currentSkStatus.endpoint.message = response.status.toString();
          this.currentSkStatus.server.version = response.body.server.id + " " + response.body.server.version;

          this.callREST();
          this.connectEndpointWS();

          this.signalKStatus.next(this.currentSkStatus);
        },
        // When not ok, this runs...
        (err: HttpErrorResponse) => {
          if (err.error instanceof Error) {
              // A client-side or network error occurred. Handle it accordingly.
              console.log('An HTTP connection error occurred:', err.error.message);
            } else {
              // The backend returned an unsuccessful response code.
              // The response body may contain clues as to what went wrong,
              console.log(err);
            }
          this.currentSkStatus.endpoint.status = false;
          this.currentSkStatus.endpoint.message = err.message;
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
              this.SignalKFullService.processFullUpdate(response.body);
            },
            // When not ok, this runs...
            (err: HttpErrorResponse) => {
                if (err.error instanceof Error) {
                  // A client-side or network error occurred. Handle it accordingly.
                  this.currentSkStatus.rest.message = err.error.message;
                  console.log('A REST error occurred:', err.error.message);
                } else {
                    // The backend returned an unsuccessful response code.
                    // The response body may contain clues as to what went wrong,
                    this.currentSkStatus.rest.message = "Unspecified REST error";
                    console.log(err);
                }
                this.currentSkStatus.rest.status = false;
            }
        );
    }

    connectEndpointWS() {
      if (this.endpointWS === null) {
        //no endpoint, try again later....
        setTimeout(()=>{ this.connectEndpointWS();}, 3000);
        return;
      }

      let endpointArgs = "?subscribe=all";

      if ((this.signalKToken.token !== null)&&(this.signalKToken.token != "")) {
        endpointArgs += "&token="+this.signalKToken.token;
      }

      this.webSocket = new WebSocket(this.endpointWS+endpointArgs);

      this.webSocket.onopen = function (event){
        this.currentSkStatus.websocket.message = "Connected";
        this.currentSkStatus.websocket.status = true;
      }.bind(this);

      this.webSocket.onerror = function (event) {
        this.currentSkStatus.websocket.message = "Unspecified WebSocket error";
        this.currentSkStatus.websocket.status = false;
        setTimeout(()=>{ this.connectEndpointWS();}, 3000);
      }.bind(this);

      this.webSocket.onclose = function (event) {
        this.currentSkStatus.websocket.message = "WebSocket closed";
        this.currentSkStatus.websocket.status = false;
        setTimeout(()=>{ this.connectEndpointWS();}, 3000);
      }.bind(this);

      this.webSocket.onmessage = function(message) {
          this.signalKDeltaService.processWebsocketMessage(JSON.parse(message.data));
      }.bind(this);
    }

    publishDelta(message: string) {

      if (!this.currentSkStatus.websocket.status) {
        console.log("Tried to publish delta while not connected to Websocket");
        return;
      }
      this.webSocket.send(message);
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

}
