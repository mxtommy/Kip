import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';


import { AppSettingsService } from './app-settings.service';


@Injectable()
export class SignalKService {

    signalKURLSub: Subscription;
    signalKURL: string;


    constructor(private AppSettingsService: AppSettingsService) {
    // when signalKUrl changes, do stuff
    this.signalKURLSub = this.AppSettingsService.getSignalKURLAsO().subscribe(
        newURL => {
            this.signalKURL = newURL;
            this.resetSignalK();
          }
      );

    }
    
    resetSignalK() {
        console.log("Reseting SignalK URL: " + this.signalKURL);
    }


    connectSignalK(host:string) {
        //var client = new signalkJsClient.client('localhost');

        return 3
    }
    



}