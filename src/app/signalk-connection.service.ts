import { Injectable } from '@angular/core';
import { of ,  Observable ,  Subject ,  BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { AppSettingsService, appSettings } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { SignalKFullService } from './signalk-full.service';
import { NotificationsService } from './notifications.service';



interface signalKEndpointResponse {
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

// TODO, use this instead of individual vars
export interface signalKStatus {
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
    }

}


@Injectable()
export class SignalKConnectionService {


    // Main URL Variables
    signalKURL: string;
    signalKToken: string;
    endpointREST: string;
    endpointWS: string;

    // Websocket
    webSocket: WebSocket = null;

    // status
    signalKStatus: BehaviorSubject<signalKStatus> = new BehaviorSubject<signalKStatus>({
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
        }
    });

    signalKURLOK: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    signalKURLMessage: BehaviorSubject<string> = new BehaviorSubject<string>('');


    webSocketStatusOK:  BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true); // defaults to true so we don't say not connected right away
    webSocketStatusMessage: BehaviorSubject<string> = new BehaviorSubject<string>('waiting to connect');

    // REST API
    restStatusOk: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    restStatusMessage: BehaviorSubject<string> = new BehaviorSubject<string>('waiting for endpoint');


    //////////////////////////////////////////////////////////////////////////////////////////////////
    //// constructor, mostly sub to stuff for changes.
    constructor(
        private SignalKService: SignalKService,
        private SignalKDeltaService: SignalKDeltaService,
        private SignalKFullService: SignalKFullService,
        private AppSettingsService: AppSettingsService, 
        private NotificationsService: NotificationsService,
        private http: HttpClient) 
    {
        // when signalKUrl changes, do stuff
        this.AppSettingsService.getSignalKURLAsO().subscribe(
          newURL => {
            this.signalKURL = newURL;
            if (this.webSocket !== null) {
              
            }
            this.resetSignalK();
          }
        );
        // when token changes, do stuff
        this.AppSettingsService.getSignalKTokenAsO().subscribe(
          newToken => {
            this.signalKToken = newToken;
            if (this.webSocket !== null) {
              this.webSocket.close();
            }
          }
        );
    }



    resetSignalK() {
        // TODO close current connections/reset data, check api version... assuming v1
        console.debug("Reseting SignalK URL: " + this.signalKURL);
        this.SignalKService.resetSignalKData();
        this.endpointREST = null;
        this.endpointWS = null;
        this.signalKURLOK.next(false);
        this.signalKURLMessage.next("Connecting...");
        this.NotificationsService.resetAlarms();
        if (this.webSocket != null) {
            this.webSocket.close(); // TODO, new websocket gets created before this one closes sometimes. Need to make sure doesn't happen.
        }
        this.restStatusOk.next(false);
        this.restStatusMessage.next('waiting for endpoint');

        
        let fullURL = this.signalKURL;
        let re = new RegExp("signalk/?$");
        if (!re.test(fullURL)) {
            fullURL = fullURL + "/signalk/";
        }

        this.http.get<signalKEndpointResponse>(fullURL, {observe: 'response'}).subscribe(
            // when we go ok, this runs
            response => {
                this.signalKURLOK.next(true);
                this.signalKURLMessage.next("HTTP " + response.status + ": " + response.statusText 
                    + ". Server: " + response.body.server.id + " Ver: " + response.body.server.version);
                this.endpointREST = response.body.endpoints.v1["signalk-http"];
                this.endpointWS = response.body.endpoints.v1["signalk-ws"];
                this.callREST();
                this.connectEndpointWS();
                
            },
            // When not ok, this runs...
            (err: HttpErrorResponse) => {
                if (err.error instanceof Error) {
                    // A client-side or network error occurred. Handle it accordingly.
                    console.log('An error occurred:', err.error.message);
                  } else {
                    // The backend returned an unsuccessful response code.
                    // The response body may contain clues as to what went wrong,
                    console.log(err);
                  }
                this.signalKURLOK.next(false);
                this.signalKURLMessage.next(err.message);
                this.webSocketStatusOK.next(false);
            }
        );
    }

    callREST() {
        this.http.get(this.endpointREST, {observe: 'response'}).subscribe(
            // when we go ok, this runs
            response => {
                this.restStatusOk.next(true);
                this.restStatusMessage.next("HTTP " + response.status + ": " + response.statusText );
                this.SignalKFullService.processFullUpdate(response.body);   
                
            },
            // When not ok, this runs...
            (err: HttpErrorResponse) => {
                if (err.error instanceof Error) {
                    // A client-side or network error occurred. Handle it accordingly.
                    console.log('An error occurred:', err.error.message);
                  } else {
                    // The backend returned an unsuccessful response code.
                    // The response body may contain clues as to what went wrong,
                    console.log(err);
                  }
                this.restStatusOk.next(false);
                this.restStatusMessage.next(err.message);
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
        if ((this.signalKToken !== null)&&(this.signalKToken != "")) {
          endpointArgs += "&token="+this.signalKToken;
        }
        this.webSocketStatusMessage.next("Connecting...");
        this.webSocket = new WebSocket(this.endpointWS+endpointArgs);
        this.webSocket.onopen = function (event){
            this.webSocketStatusOK.next(true);
            this.webSocketStatusMessage.next("Connected");
            this.NotificationsService.newNotification("Connected to server", 1000);
        }.bind(this);

        this.webSocket.onerror = function (event) {
            this.webSocketStatusOK.next(false);
            this.webSocketStatusMessage.next('Unspecified Error');
            setTimeout(()=>{ this.connectEndpointWS();}, 3000);
        }.bind(this);

        this.webSocket.onclose = function (event) {
            this.webSocketStatusOK.next(false);
            this.webSocketStatusMessage.next("Disconnected");
            setTimeout(()=>{ this.connectEndpointWS();}, 3000);
        }.bind(this);

        this.webSocket.onmessage = function(message) {
            this.SignalKDeltaService.processWebsocketMessage(JSON.parse(message.data));
        }.bind(this);
    }


    publishDelta(message: string) {

      if (!this.webSocketStatusOK.value) {
        console.log("Tried to publish delta while not connected to Websocket");
        return;
      }
      this.webSocket.send(message);
    }

    postApplicationData(scope: string, configName: string, data: Object): Observable<string[]> {
        

      let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
      url += "applicationData/" + scope +"/kip/1.0/"+ configName;

      let options = {};

      if ((this.signalKToken !== null)&&(this.signalKToken != "")) {
        options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken);
      }
      return this.http.post<any>(url, data, options).pipe(
        catchError(this.handleError<string[]>('postApplicationData', []))
      );

    }




    

    getApplicationDataKeys(scope: string): Observable<string[]> {
      let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
      url += "applicationData/" + scope +"/kip/1.0/?keys=true";

      let options = {};

      if ((this.signalKToken !== null)&&(this.signalKToken != "")) {
        options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken);
      }

      return this.http.get<string[]>(url, options).pipe(
        tap(_ => {
          console.log("Server Stored Configs for "+ scope +": "); console.log(_) 
        }),
        catchError(this.handleError<string[]>('getApplicationDataKeys', []))
      );

    }

    getApplicationData(scope: string, configName: string): Observable<appSettings>{
      let url = this.endpointREST.substring(0,this.endpointREST.length - 4); // this removes 'api/' from the end
      url += "applicationData/" + scope +"/kip/1.0/" + configName;
      let options = {};

      if ((this.signalKToken !== null)&&(this.signalKToken != "")) {
        options['headers'] = new HttpHeaders().set("authorization", "JWT "+this.signalKToken);
      }
      return this.http.get<appSettings>(url, options).pipe(
        tap(_ => {
          console.log("Fetched Stored Configs for "+ scope +" / "+ configName); 
        }),
        catchError(this.handleError<appSettings>('getApplicationData'))
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

    //borring stuff, return observables etc

    getEndpointAPIStatus() {
        return this.signalKURLOK.asObservable();
    }
    getEndpointAPIStatusMessage() {
        return this.signalKURLMessage.asObservable();
    }
    getEndpointWSStatus() {
        return this.webSocketStatusOK.asObservable();
    }
    getEndpointWSMessage() {
        return this.webSocketStatusMessage.asObservable();
    }
    getEndpointRESTStatus() {
        return this.restStatusOk.asObservable();
    }
    getEndpointRESTMessage() {
        return this.restStatusMessage.asObservable();
    }


}
