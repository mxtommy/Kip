import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  Subject } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { ISignalKDeltaMessage } from './signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';
import { NotificationsService } from './notifications.service';
import { AuththeticationService } from './auththetication.service';

const deltaStatusCodes = {
  200: "The request was successfully.",
  202: "The request is awaiting authorization.",
  400: "Bad Client request format.",
  401: "Login failed. Your User ID or Password is incorrect.",
  403: "DENIED: You must be authenticated to send commands. Configure server connection authentication or requets a Device Authorization token.",
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

  private requestStatus$ = new Subject<skRequest>(); // public Observable passing message post processing
  private requests: skRequest[] = []; // Private array of all requests.

  constructor(
    private signalKDeltaService: SignalKDeltaService,
    private appSettingsService: AppSettingsService,
    private NotificationsService: NotificationsService,
    private auth: AuththeticationService,
    ) {
      // Observer to get all signalk-delta messages of type request type.
      const requestsSub: Subscription = this.signalKDeltaService.subscribeRequestUpdates().subscribe(
        requestMessage => { this.updateRequest(requestMessage); }
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
    let deviceTokenRequest = {
      requestId: requestId,
      accessRequest: {
        clientId: this.appSettingsService.KipUUID,
        description: "Kip web app",
        permissions: "admin"
      }
    }

    console.log("[Request Service] Requesting Device Authorization Token");
    this.signalKDeltaService.publishDelta(deviceTokenRequest);

    let request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }

    this.requests.push(request);
  }

  /**
  * Submit a SignalK WebSocket User login request - user needs to exist in SignalK Server.
  * Required to use the SignalK User Storage feature (ie. to store Config by users)
  * and if you need to submit data to SignalK.
  *
  * An alternative to user authentification is to use requestDeviceAccessToken method
  * removing the need for usr/pwd but this will limit Kip's automatic Config sharing feature.
  *
  * Once approved, the user authorization Token will be saved in the Config and sent with every
  * requests.
  *
  * @param {string} userId The SignalK server User ID
  * @param {string} userPassword The SignalK server user Password
  * @return {*} {string} requestId Identifier for this specific request. Enables Request result monitoring.
  * @memberof SignalkRequestsService
  */
  public requestUserLogin(userId: string, userPassword: string): string {
    let requestId = this.newUuid();
    let loginRequest = {
      requestId: requestId,
      login: {
        username: userId,
        password: userPassword
      }
    }

    console.log("[Request Service] Requesting User Login");
    this.signalKDeltaService.publishDelta(loginRequest);

    let request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }
    this.requests.push(request);
    return requestId;
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
    this.signalKDeltaService.publishDelta(message); //send request

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
  private updateRequest(delta: ISignalKDeltaMessage) {
    let index = this.requests.findIndex(r => r.requestId == delta.requestId);
    if (index > -1) {  // exists in local array
      this.requests[index].state = delta.state;
      this.requests[index].statusCode = delta.statusCode;
      this.requests[index].message = delta.message;

      const currentStatusCode = deltaStatusCodes[delta.statusCode];

      if ((typeof currentStatusCode != 'undefined') && (this.requests[index].statusCode == 200 || this.requests[index].statusCode == 202 || this.requests[index].statusCode == 401 || this.requests[index].statusCode == 405)) {
        this.requests[index].statusCodeDescription = currentStatusCode;

        if (this.requests[index].statusCode == 202) {
          this.NotificationsService.sendSnackbarNotification(this.requests[index].statusCodeDescription);
          return;
        }

        if (this.requests[index].statusCode == 405) {
          console.log("[Request Service] Status Code: " + this.requests[index].statusCode + " - " + this.requests[index].message);
        }

        if ((delta.accessRequest !== undefined) && (delta.accessRequest.token !== undefined)) {
          this.NotificationsService.sendSnackbarNotification(delta.accessRequest.permission + ": Device Access Token received from server.");
          console.log(`[Request Service] ${delta.accessRequest.permission}: Device Access Token received`);
          this.auth.setDeviceAccessToken(delta.accessRequest.token);

        } else if (delta.login !== undefined) {
          // Delta (WebSocket) login not implemented. Use REST login from
          // Authetification service to obtain Session token
          if (delta.login.token !== undefined) {
            // Do logic
          }

        }

      } else {
        this.NotificationsService.sendSnackbarNotification("ERROR: Unknown Request Status Code received: " + this.requests[index].statusCode + " - " + deltaStatusCodes[this.requests[index].statusCode] + " - " + this.requests[index].message);
        console.error("[Request Service] Unknown Request Status Code received: " + this.requests[index].statusCode + " - " + deltaStatusCodes[this.requests[index].statusCode] + " - " + this.requests[index].message);
      }
      try {
        this.requestStatus$.next(this.requests[index]);    // dispatched results
        this.requests.splice(index, 1);                 // cleanup array
      } catch (err) {
        this.requestStatus$.error(err);
        console.error("[Request Service] " + err);
        this.requests = []; // flush array to clean values that will become stale post error
      }
    } else {
      this.NotificationsService.sendSnackbarNotification("ERROR: A request message that contains an unknown Request ID was received. Request Delta:\n" + JSON.stringify(delta));
      console.error("[Request Service] A Request message that contains an unknown Request ID was received. from delta:\n" + JSON.stringify(delta))
    }
  }

  /**
   * Subscribe to SignalK request response. This allows you to inspect server
   * response information such as State, Status Codes and such for further processing
   * logic. Subscription object should be used for the Return :)
   *
   * @return Observable of type skRequest.
   */
  public subscribeRequest(): Observable<skRequest> {
    return this.requestStatus$.asObservable();
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
}
