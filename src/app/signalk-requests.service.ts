import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject ,  BehaviorSubject } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { deltaMessage } from './signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';
import { NotificationsService } from './notifications.service';


interface signalKRequest {
  requestId: string;
  state: string;
  statusCode: number;
}

@Injectable({
  providedIn: 'root'
})
export class SignalkRequestsService {

  requests: signalKRequest[] = [];
  requestsSub: Subscription; // used to get all the requests from signalk-delta while avoiding circular dependencies in services...

  constructor(private SignalKConnectionService: SignalKConnectionService,
    private SignalKDeltaService: SignalKDeltaService,
    private AppSettingsService: AppSettingsService,
    private NotificationsService: NotificationsService,
    ) { 
      this.requestsSub = this.SignalKDeltaService.subcribeRequest().subscribe(
        requestMessage => { this.updateRequest(requestMessage); }
      );
    }


  public requestAuth() {
    let requestId = this.newUuid();
    let accessRequest = {
      requestId: requestId,
      accessRequest: {
        clientId: this.newUuid(),
        description: "Kip web app",
        permissions: "readwrite"
      }
    }

    this.SignalKConnectionService.publishDelta(JSON.stringify(accessRequest));
    let request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }
    this.requests.push(request);  
  }

  public putRequest(path: string, source: string, value: any)  {
    let requestId = this.newUuid();
    let noSelfPath = path.replace(/^(self\.)/,""); //no self in path...
    let message = {
      "requestId": requestId,
      "put": {
        "path": noSelfPath,
        "value": value
      }
    }      
    this.SignalKConnectionService.publishDelta(JSON.stringify(message));
    let request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }
    this.requests.push(request);

  }



  public updateRequest(delta: deltaMessage) {
    let rIndex = this.requests.findIndex(r => r.requestId == delta.requestId);
    if (rIndex >= 0) { // exists
      this.requests[rIndex].state = delta.state;
      this.requests[rIndex].statusCode = delta.statusCode;
    }
    if ((delta.accessRequest !== undefined) && (delta.accessRequest.token !== undefined)) {
      console.log("got new token!");
      this.NotificationsService.newNotification("Got Token for server!");
      this.AppSettingsService.setSignalKToken(delta.accessRequest.token);
    }
    console.log("Put Result: " + delta.statusCode);  
    // TODO, update this.requests and do something on auth fail etc

  }



  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
}
