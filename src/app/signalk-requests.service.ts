import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { IDeltaMessage } from './signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';
import { NotificationsService } from './notifications.service';

const deltaStatusCodes = {
  200: "The request was successfully.",
  202: "The request is awaiting authorization.",
  400: "Bad Client request format.",
  401: "Login failed. Your username or password is incorrect.",
  403: "You must be authenticated to send commands. Configure user authentication or request and approve a device Authorization Token.",
  405: "The server does not support the request.",
  500: "The request failed.",
  502: "Something went wrong carrying out the request on the server side.",
  504: "Timeout on the server side trying to carry out the request."
}
export interface skRequest {
  requestId: string;
  state: string;
  statusCode: number;
  statusCodeDescription?: string;
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

      requestsSub = this.SignalKDeltaService.subscribeRequest().subscribe(
        requestMessage => { this.updateRequest(requestMessage); }
      );

      let endPointStatus: Subscription; // Monitor if Endpoints are reset and clean up
      endPointStatus = this.SignalKConnectionService.getSignalKConnectionsStatus().subscribe(
        signalKConnections => {
          if (!signalKConnections.rest.status) {
            this.requests = []; // flush array to clean values that will become stale post error or server reconnect
          }
        }
      );
    }

  /**
   * Submit a SignalK server Read/Write Device authorization token request - only required
   * if you need to submit data to SignalK (PUT or storage requests).
   *
   * Once approved, a Devices authorization Token will be saved in the Kip
   * Config and sent with every requests.
   *
   * The Device authorization is a manual process done on the server.
   */
  public requestDeviceAccessToken() {
    let requestId = this.newUuid();
    let accessTokenRequest = {
      requestId: requestId,
      accessRequest: {
        clientId: this.AppSettingsService.getKipUUID(),
        description: "Kip web app",
        permissions: "admin"
      }
    }

    this.SignalKConnectionService.publishDelta(JSON.stringify(accessTokenRequest));
    let request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }

    this.requests.push(request);
  }

   /**
   * Submit a SignalK server User login request - user needs to exist in SignalK Server.
   * Required to use the SignalK User Storage feature (ie. to store Config by users)
   * and if you need to submit data to SignalK.
   *
   * An alternative is to use requestDeviceAccessToken method removing the need for usr/pwd but
   * this will limit Kip's automatic Config sharing feature.
   *
   * Once approved, the user authorization Token will be saved in the Config and sent with every
   * requests.
   *
   * @param userId The login User ID
   * @param userPassword The user Password
   */
    public requestUserLogin(userID: string, userPassword: string) {
      let requestId = this.newUuid();
      let loginRequest = {
        requestId: requestId,
        login: {
          username: userID,
          password: userPassword
        }
      }

      this.SignalKConnectionService.publishDelta(JSON.stringify(loginRequest));
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
    let selfContext: string = "vessels.self";    // hard coded context. Could be dynamic at some point
    let message = {
      "context": selfContext,
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

  /**
   * Handles request updates, issue display and logging.
   *
   * @param delta SignalK Delta message
   */
  private updateRequest(delta: IDeltaMessage) {
    let index = this.requests.findIndex(r => r.requestId == delta.requestId);
    if (index > -1) {  // exists in local array
      this.requests[index].state = delta.state;
      this.requests[index].statusCode = delta.statusCode;
      this.requests[index].message = delta.message;

      const currentStatusCode = deltaStatusCodes[delta.statusCode];

      if ((typeof currentStatusCode != 'undefined') && (this.requests[index].statusCode == 200 || this.requests[index].statusCode == 202 || this.requests[index].statusCode == 401)) {
        this.requests[index].statusCodeDescription = currentStatusCode;

        if (this.requests[index].statusCode == 202) {
          this.NotificationsService.sendSnackbarNotification(this.requests[index].statusCodeDescription);
          return;
        }
        if (this.requests[index].statusCode == 401) {
          this.NotificationsService.sendSnackbarNotification(this.requests[index].statusCode + " - " +this.requests[index].statusCodeDescription);
        }
        if ((delta.accessRequest !== undefined) && (delta.accessRequest.token !== undefined)) {
          this.AppSettingsService.setSignalKToken({token: delta.accessRequest.token, isNew: true, isSessionToken: false});
          this.NotificationsService.sendSnackbarNotification(delta.accessRequest.permission + ": Read/Write Token request response received from server.");
          console.log(delta.accessRequest.permission + ": New R/W token response received");
          return;
        }

        if ((delta.login !== undefined) && (delta.login.token !== undefined)) {
          this.AppSettingsService.setSignalKToken({token: delta.login.token, isNew: true, isSessionToken: true});
          this.NotificationsService.sendSnackbarNotification("User authentication successful. TTL: " + delta.login.timeToLive);
          console.log("server login successful");
          return;
        }
      } else {
        this.NotificationsService.sendSnackbarNotification("Request Error received: " + this.requests[index].statusCode + " - " + deltaStatusCodes[this.requests[index].statusCode] + " - " + this.requests[index].message);
        console.log("Request Error received: " + this.requests[index].statusCode + " - " + deltaStatusCodes[this.requests[index].statusCode] + " - " + this.requests[index].message);
      }
      try {
        this.requestStatus.next(this.requests[index]);    // Broadcast results
        this.requests.splice(index, 1);                 // result dispatched, cleanup array
      } catch (err) {
        this.requestStatus.error(err);
        console.log(err);
        this.requests = []; // flush array to clean values that will become stale post error
      }
    } else {
      this.NotificationsService.sendSnackbarNotification("Received unknown Request delta:\n" + JSON.stringify(delta));
      console.log("Received unknown Request delta:\n" + JSON.stringify(delta))
    }
  }

  /**
   * Subscribe to SignalK request response. This allows you to inspect server response information such as State, Status Codes and such for further processing logic. Subscription object should be used for the Return :)
   *
   * @return Observable if type skRequest.
   */
  public subscribeRequest(): Observable<skRequest> {
    return this.requestStatus.asObservable();
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
}
