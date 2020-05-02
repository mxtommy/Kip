import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject ,  BehaviorSubject } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { deltaMessage } from './signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';
import { NotificationsService } from './notifications.service';


export interface skRequest {
  requestId: string;
  state: string;
  statusCode: number;
  widgetUUID?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignalkRequestsService {

  private requestStatus = new Subject<skRequest>(); // public Observable passing message post processing
  private requests: skRequest[] = []; // Private array of all requests.

  constructor(
    private SignalKConnectionService: SignalKConnectionService,
    private SignalKDeltaService: SignalKDeltaService,
    private AppSettingsService: AppSettingsService,
    private NotificationsService: NotificationsService,
    ) {
      let requestsSub: Subscription; // used to get all the requests from signalk-delta while avoiding circular dependencies in services...

      requestsSub = this.SignalKDeltaService.subcribeRequest().subscribe(
        requestMessage => { this.updateRequest(requestMessage); }
      );

      let endPointStatus: Subscription; // check if the Endpoint are reset
      endPointStatus = this.SignalKConnectionService.getEndpointAPIStatus().subscribe(
        status => {
          if (!status) {
            this.requests = []; // flush array to clean values that will become stale post error or server reconnect
          }
        }
      );
    }

  /**
   * Submit a SignalK server Read/Write authorization request - only required if you need to
   * submit data to SignalK.
   *
   * Once approved, an authorization Token will be sent and automatically saved in the Kip
   * Config. The authorization is a manual process done on the
   * server.
   */
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


  /**
     * Sends request to SignalK server and returns requestId.
     * @param path SignalK full path. Automatically removes "self" if included in path.
     * @param value Value to be sent.
     * @param widgetUUID Optional - Subscriber's Widget UUID to be included as part of
     * the subscribeRequest Subject response. Enables Widget specific filtering.
     * @return requestId Identifier for this specific request. Enables Request specific filtering.
     */
  public putRequest(path: string, value: any, widgetUUID: string): string {
    let requestId = this.newUuid();
    let noSelfPath = path.replace(/^(self\.)/,""); //no self in path...
    let message = {
      "requestId": requestId,
      "put": {
        "path": noSelfPath,
        "value": value
      }
    }
    this.SignalKConnectionService.publishDelta(JSON.stringify(message)); //send request

    let request: skRequest = {
      requestId: requestId,
      state: null,
      statusCode: null,
      widgetUUID: widgetUUID,
    };

    this.requests.push(request); // save to private array pending response with widgetUUID so we can filter response from subscriber
    return requestId; // return the ID to the Subscriber, if tracking of individual request is required
  }

  private updateRequest(delta: deltaMessage) {
   let index = this.requests.findIndex(r => r.requestId == delta.requestId);
    if (index > -1) {  // exists in local array
      this.requests[index].state = delta.state;
      this.requests[index].statusCode = delta.statusCode;
      this.requests[index].message = delta.message;
      if ((delta.accessRequest !== undefined) && (delta.accessRequest.token !== undefined)) {
        this.AppSettingsService.setSignalKToken(delta.accessRequest.token);
        this.NotificationsService.newNotification("Read/Write Token request approval received for server");
        console.log("New R/W token received");
      }

      try {
        this.requestStatus.next(this.requests[index]); // Broadcast results
        this.requests.splice(index, 1); // subject dispatched, cleanup array
      } catch (err) {
        this.requestStatus.error(err);
        console.log(err);
        this.requests = []; // flush array to clean values that will become stale post error
      }
    }
  }


  /**
   * Subscribe to SignalK put Request response. This allows you to inspect server response information such as State, Status Codes and such for further processing logic. Subscription object should be used for the Return :)
   *
   * @return Observable if type skRequest.
   */
  public subcribeRequest(): Observable<skRequest> {
    return this.requestStatus.asObservable();
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
}
