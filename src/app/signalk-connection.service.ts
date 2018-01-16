import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { AppSettingsService } from './app-settings.service';
import { SignalKService } from './signalk.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { SignalKFullService } from './signalk-full.service';




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
    endpointREST: string;
    endpointWS: string;

    // Websocket
    webSocket: WebSocket;

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


    webSocketStatusOK:  BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    webSocketStatusMessage: BehaviorSubject<string> = new BehaviorSubject<string>('waiting for endpoint');

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
        private http: HttpClient) 
    {
        // when signalKUrl changes, do stuff
        this.AppSettingsService.getSignalKURLAsO().subscribe(
            newURL => {
                this.signalKURL = newURL;
                this.resetSignalK();
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
                this.signalKURLMessage.next('Unknown Error');
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
                this.restStatusMessage.next('Unknown Error');
            }
        );    
    }

    connectEndpointWS() {
        if (this.endpointWS === null) {
            //no endpoint, try again later....
            setTimeout(()=>{ this.connectEndpointWS();}, 3000);
            return;
        }
        this.webSocketStatusMessage.next("Connecting...");
        this.webSocket = new WebSocket(this.endpointWS+"?subscribe=all");
        this.webSocket.onopen = function (event){
            this.webSocketStatusOK.next(true);
            this.webSocketStatusMessage.next("Connected");
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