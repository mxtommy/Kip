import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { AppSettingsService } from './app-settings.service';




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


@Injectable()
export class SignalKService {

    // URL Variables
    signalKURL: string;

    signalKURLOK: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    signalKURLMessage: BehaviorSubject<string> = new BehaviorSubject<string>('');

    endpointHTTP: string;
    endpointWS: string;

    // SigK Data
    dataFullTree

    // Websocket
    private webSocket: WebSocket;

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //// constructor, mostly sub to stuff for changes.
    constructor(
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
        console.log("Reseting SignalK URL: " + this.signalKURL);
        this.http.get<signalKEndpointResponse>(this.signalKURL, {observe: 'response'}).subscribe(
            // when we go ok, this runs
            response => {
                this.signalKURLOK.next(true);
                this.signalKURLMessage.next("HTTP " + response.status + ": " + response.statusText 
                    + ". Server: " + response.body.server.id + " Ver: " + response.body.server.version);
                this.endpointHTTP = response.body.endpoints.v1["signalk-http"];
                this.endpointWS = response.body.endpoints.v1["signalk-ws"];
                this.updateEndpointHTTP();
                this.updateEndpointWS();
                
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

    
    updateEndpointHTTP() {
        console.log(this.endpointHTTP);
    }

    updateEndpointWS() {
        if (this.webSocket != null) {
            console.log("closing existing websocket");
            this.webSocket.close();
        }
        this.webSocket = new WebSocket(this.endpointWS);

        
    }

    //borring stuff, return observables etc

    getEndpointAPIStatus() {
        return this.signalKURLOK.asObservable();
    }
    getEndpointAPIStatusMessage() {
        return this.signalKURLMessage.asObservable();
    }



}