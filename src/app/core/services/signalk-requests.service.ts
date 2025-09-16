import { Injectable, inject } from '@angular/core';
import { Observable , Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppSettingsService } from './app-settings.service';
import { ISignalKDeltaMessage } from '../interfaces/signalk-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';
import { AuthenticationService } from './authentication.service';
import { UUID } from '../utils/uuid.util'
import { AppService } from './app-service';

const deltaStatusCodes = {
  200: "The request was successfully.",
  202: "Request accepted and pending completion.",
  400: "Something is wrong with the client's request.",
  401: "Login failed. Your User ID or Password is incorrect.",
  403: "DENIED: Authorization with R/W or Admin permission level is required to send commands. Configure Sign In credential.",
  405: "The server does not support the request.",
  500: "The request failed.",
  502: "Something went wrong carrying out the request on the server.",
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
  private signalKDeltaService = inject(SignalKDeltaService);
  private appSettingsService = inject(AppSettingsService);
  private appService = inject(AppService);
  private auth = inject(AuthenticationService);


  private requestStatus$ = new Subject<skRequest>(); // public Observable passing message post processing
  private requests: skRequest[] = []; // Private array of all requests.

  constructor() {
      // Observer to get all signalk-delta messages of type request type.
      this.signalKDeltaService.subscribeRequestUpdates()
        .pipe(takeUntilDestroyed())
        .subscribe(requestMessage => { this.updateRequest(requestMessage); });
    }

  /**
   * Submit a Signal K server Read/Write Device authorization token request - only required
   * if you need to submit data to Signal K (PUT or storage requests).
   *
   * Once approved, a Devices authorization Token will be saved in the Kip
   * Config and sent with every requests.
   *
   * The Device authorization is a manual process done on the server.
   */
  public requestDeviceAccessToken(): string {
    const requestId = UUID.create();
    const deviceTokenRequest = {
      requestId: requestId,
      accessRequest: {
        clientId: this.appSettingsService.KipUUID,
        description: "KIP Instrument MDF",
        permissions: "admin"
      }
    }

    console.log("[Request Service] Requesting Device Authorization Token");
    this.signalKDeltaService.publishDelta(deviceTokenRequest);

    const request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }

    this.requests.push(request);
    return requestId;
  }

  /**
  * Submit a Signal K WebSocket User login request - user needs to exist in Signal K Server.
  * Required to use the Signal K User Storage feature (ie. to store Config by users)
  * and if you need to submit data to Signal K.
  *
  * An alternative to user authentication is to use requestDeviceAccessToken method
  * removing the need for usr/pwd but this will limit Kip's automatic Config sharing feature.
  *
  * Once approved, the user authorization Token will be saved in the Config and sent with every
  * requests.
  *
  * @param {string} userId The Signal K server User ID
  * @param {string} userPassword The Signal K server user Password
  * @return {*} {string} requestId Identifier for this specific request. Enables Request result monitoring.
  * @memberof SignalkRequestsService
  */
  public requestUserLogin(userId: string, userPassword: string): string {
    const requestId = UUID.create();
    const loginRequest = {
      requestId: requestId,
      login: {
        username: userId,
        password: userPassword
      }
    }

    console.log("[Request Service] Requesting User Login");
    this.signalKDeltaService.publishDelta(loginRequest);

    const request = {
      requestId: requestId,
      state: null,
      statusCode: null
    }
    this.requests.push(request);
    return requestId;
  }

  /**
   * Sends a async PUT request to the Signal K server and returns a requestId for tracking.
   *
   * @param path - The Signal K full path to write to. Must be a non-empty string. If
   * the path starts with 'self.', it will be removed automatically.
   * @param value - The value to be sent. Can be any type, but must not be undefined.
   * @param widgetUUID - (Optional) The widget's UUID. Used for filtering responses
   * specific to the requesting widget.
   * @returns The Signal K server generated request tracking number
   * for this PUT.
   *
   * Returns null and logs an error if the server did not accept the request or if
   * the path is missing/empty or the value is undefined.
   *
   * @example
   *   const reqId = putRequest('navigation.lights', true, 'this.widgetProperties.uuid');
   *   if (reqId) { ... }
   */
  public putRequest(path: string, value: unknown, widgetUUID: string): string | null {
    if (typeof value === 'undefined') {
      console.error("[Request Service] Undefined value for PUT request");
      return null;
    }
    if (!path) {
      console.error("[Request Service] Path is required for PUT request");
      return null;
    }
    const requestId = UUID.create();
    const noSelfPath = path.replace(/^(self\.)/,""); //no self in path...
    const selfContext = "vessels.self";    // hard coded context. Could be dynamic at some point
    const message = {
      "context": selfContext,
      "requestId": requestId,
      "put": {
        "path": noSelfPath,
        "value": value,
      }
    }
    this.signalKDeltaService.publishDelta(message); //send request

    const request: skRequest = {
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
   * @param delta Signal K Delta message
   */
  private updateRequest(delta: ISignalKDeltaMessage) {
    const index = this.requests.findIndex(r => r.requestId == delta.requestId);
    if (index > -1) {  // exists in local array
      this.requests[index].state = delta.state;
      this.requests[index].statusCode = delta.statusCode;
      this.requests[index].message = delta.message;

      const currentStatusCode = deltaStatusCodes[delta.statusCode];

      if ((typeof currentStatusCode != 'undefined') && (this.requests[index].statusCode == 200 || this.requests[index].statusCode == 202 || this.requests[index].statusCode == 400 || this.requests[index].statusCode == 401 || this.requests[index].statusCode == 403 || this.requests[index].statusCode == 405)) {
        this.requests[index].statusCodeDescription = currentStatusCode;

        if (this.requests[index].statusCode == 202) {
          console.log("[Request Service] Async 202 response received");
          return;
        }

        if (this.requests[index].statusCode == 400) {
          this.appService.sendSnackbarNotification(this.requests[index].message);
          console.log("[Request Service] " + this.requests[index].message );
        }

        if (this.requests[index].statusCode == 403) {
          console.warn("[Request Service] Status Code: " + this.requests[index].statusCode + " - " + this.requests[index].statusCodeDescription);
        }

        if (this.requests[index].statusCode == 405) {
          console.error("[Request Service] Status Code: " + this.requests[index].statusCode + " - " + this.requests[index].message);
        }

        if ((delta.accessRequest !== undefined) && (delta.accessRequest.token !== undefined)) {
          this.appService.sendSnackbarNotification(delta.accessRequest.permission + ": Device Access Token received from server.");
          console.log(`[Request Service] ${delta.accessRequest.permission}: Device Access Token received`);
          this.auth.setDeviceAccessToken(delta.accessRequest.token);

        } else if (delta.login !== undefined) {
          // Delta (WebSocket) login not implemented. Use REST login from
          // Authentication service to obtain Session token
          if (delta.login.token !== undefined) {
            // Do logic
          }

        }

      } else {
        this.appService.sendSnackbarNotification("ERROR: Unknown Request Status Code received: " + this.requests[index].statusCode + " - " + deltaStatusCodes[this.requests[index].statusCode] + " - " + this.requests[index].message);
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
      this.appService.sendSnackbarNotification("ERROR: A request message that contains an unknown Request ID was received. Request Delta:\n" + JSON.stringify(delta));
      console.error("[Request Service] A Request message that contains an unknown Request ID was received. from delta:\n" + JSON.stringify(delta))
    }
  }

  /**
   * Subscribe to Signal K request response. This allows you to inspect server
   * response information such as State, Status Codes and such for further processing
   * logic. Subscription object should be used for the Return :)
   *
   * @return Observable of type skRequest.
   */
  public subscribeRequest(): Observable<skRequest> {
    return this.requestStatus$.asObservable();
  }
}
