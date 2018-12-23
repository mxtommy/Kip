import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject ,  BehaviorSubject } from 'rxjs';
import { SignalKConnectionService } from './signalk-connection.service';
import { deltaMessage } from './signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';

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
    private SignalKDeltaService: SignalKDeltaService) { 
      this.requestsSub = this.SignalKDeltaService.subcribeRequest().subscribe(
        requestMessage => { this.updateRequest(requestMessage); }
      );
    }




  public putRequest(path: string, value: any)  {
    let requestId = this.newUuid();

    let message = {
      "requestId": requestId,
      "put": {
        "path": path,
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
