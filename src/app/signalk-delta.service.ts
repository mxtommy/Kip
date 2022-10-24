import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, delay, Observable , retryWhen, Subject, switchAll, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { IDeltaMessage } from './signalk-interfaces';
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service'
import { SignalKService } from './signalk.service';
import { AuththeticationService, IAuthorizationToken } from './auththetication.service';
import { NotificationsService } from './notifications.service';

export interface IStreamStatus {
  operation: number;
  message: string;
  hasToken: boolean;
}

@Injectable({
    providedIn: 'root'
  })
export class SignalKDeltaService {

  private signalKRequests = new Subject<IDeltaMessage>();   // requests service subs to this (avoids circular dependency in services)

  // Delsta Service Endpoint status publishing
  public streamEndpoint: IStreamStatus = {
    operation: 0,
    message: "Not connected",
    hasToken: false,
  }
  public streamEndpoint$: BehaviorSubject<IStreamStatus> = new BehaviorSubject<IStreamStatus>(this.streamEndpoint);

  // Websocket config
  private endpointWS: string = null;
  private WS_RECONNECT_INTERVAL = 5000;                 // connection error retry interval
  private WS_CONNECTION_ARGUMENT = "?subscribe=all"; // default but we could use none + specific paths in the future
  private socketWS$: WebSocketSubject<any>;
  public socketWSCloseEvent$ = new Subject<CloseEvent>();
  public socketWSOpenEvent$ = new Subject<Event>();
  private messagesSubjectWS$ = new Subject();
  public messagesWS$ = this.messagesSubjectWS$.pipe(switchAll(), catchError(e => { throw e }));

  // Token
  private authToken: IAuthorizationToken = null;

  constructor(
    private signalK: SignalKService,
    private notifications: NotificationsService,
    private server: SignalKConnectionService,
    private auth: AuththeticationService,
    )
    {
      // Monitor Connection Service Endpoint Status
      this.server.serverServiceEndpoint$.subscribe((endpoitStatus: IEndpointStatus) => {
        if (endpoitStatus.operation === 2) {
          this.endpointWS = endpoitStatus.WsServiceUrl;

          if (this.socketWS$) {
            this.closeWS();
          }

          setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
            this.connectWS();
          }, 250);

        } else {
          if (this.socketWS$ && endpoitStatus.operation !== 1) {
            this.closeWS();
          }
        }
      });

      // Monitor Token changes
      this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
        if (this.authToken != token) { // When token changes, reconnect WebSocket with new token
          this.authToken = token;

          // Only if the socket is all ready up ie. resetSignalk() ran at least once.
          if (this.socketWS$ && (this.streamEndpoint.operation === 2)) {
            this.closeWS();

            setTimeout(() => {   // need a delay so WebSocket Close Observer has time to complete before connecting again.
              this.connectWS();
            }, 250);
          }
        }

      });

      // WebSocket Open Event Handling
      this.socketWSOpenEvent$.subscribe( event => {
          this.streamEndpoint.message = "Connected";
          this.streamEndpoint.operation = 2;
          if (this.authToken) {
            console.log("[Connection Service] WebSocket connected with Authorization Token")
          } else {
            console.log("[Connection Service] WebSocket connected without Authorization Token");
          }
          this.streamEndpoint$.next(this.streamEndpoint);
        }
     );

      // WebSocket closed Event Handling
      this.socketWSCloseEvent$.subscribe( event => {
        if(event.wasClean) {
          this.streamEndpoint.message = "WebSocket closed";
          this.streamEndpoint.operation = 0;
          console.log('[Connection Service] WebSocket closed');
        } else {
          console.log('[Connection Service] WebSocket terminated due to socket error');
          this.streamEndpoint.message = "WebSocket error";
          this.streamEndpoint.operation = 3;
          console.log('[Connection Service] WebSocket closed');
        }
        this.streamEndpoint$.next(this.streamEndpoint);
      });
    }

  /**
   * Connect WebSocket to server. Endpoint URL taken from Connection Sercice and
   * authentification token is taken from Authentication
   */
   public connectWS(): void {
    this.streamEndpoint.message = "Connecting";
    this.streamEndpoint.operation = 1;
    this.streamEndpoint$.next(this.streamEndpoint);

    this.socketWS$ = this.getNewWebSocket();
    const messagesWS$ = this.socketWS$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => {
            console.error("[Connection Service] WebSocket error: " + JSON.stringify(err, ["code", "message", "type"]))
          }),
          delay(this.WS_RECONNECT_INTERVAL)
        )
      )
    ).subscribe(msgWS => {
      this.processWebsocketMessage(msgWS);
    });
    //this.messagesSubjectWS$.next(messagesWS$);

  }

  /**
   * Handles connection arguments, token and links socket Open/Close Observers
   */
  private getNewWebSocket() {
    let args: string;
    if (this.authToken != null) {
      args = this.WS_CONNECTION_ARGUMENT + "&token=" + this.authToken.token;
      this.streamEndpoint.hasToken = true;
    } else {
      args = this.WS_CONNECTION_ARGUMENT;
      this.streamEndpoint.hasToken = false;
    }
    return webSocket({
      url: this.endpointWS + args,
      closeObserver: this.socketWSCloseEvent$,
      openObserver: this.socketWSOpenEvent$
    })
  }

  /**
  * Close SignalK server data stream WebSocket
  */
  public closeWS() {
    if (this.socketWS$) {
      console.log("[Connection Service] WebSocket closing...");
      this.socketWS$.complete();
    }
  }

  /**
  * Send message to WebSocket stream recipient (SignalK server).
  * @param msg JSON formated message to be sent. If the WebSocket is not
  * available, one retry after 1 sec will be made. The socket parser will automatically
  * stringify the message.
  *
  * `*** Do not pre-stringify the msg param ***`
  */
  public publishDelta(msg: any) {
    if (this.socketWS$) {
      console.log("[Connection Service] WebSocket sending message");
      this.socketWS$.next(msg);
    } else {
      setTimeout((): void => {
        console.log("[Connection Service] WebSocket retry sending message");
        this.socketWS$.next(msg);
      }, 1000);
      console.log("[Connection Service] No WebSocket present to send messsage");
    }
  }

  private processWebsocketMessage(message: IDeltaMessage) {
    // Read raw message and route to appropriate sub
    if (typeof(message.self) != 'undefined') {  // is Hello message
      this.server.setServerInfo(message.name, message.version, message.roles);
      this.signalK.setSelf(message.self);
      return;
    }


    if (typeof(message.updates) != 'undefined') {
      this.processUpdateDelta(message); // is Data Update process further
    } else if (typeof(message.requestId) != 'undefined') {
      this.signalKRequests.next(message); // is a Request, send to signalk-request service.
    } else {
      console.log("[Delta Service] Unknown message type. Message content:" + message);
    }
  }

  private processUpdateDelta(message:IDeltaMessage) {
    let context: string;
    if (typeof(message.context) == 'undefined') {
      context = 'self'; //default if not defined
    } else {
      context = message.context;
    }

    // process message Updates
    for (let update of message.updates) {
      // get source identifier. 'src' is nmea2k and 'talker' is nmea0183
      let source = '';
      if ((update.source !== undefined) && (update.source.type !== undefined) && update.source.label !== undefined) {
        if (update.source.type == 'NMEA2000') {
          source = update.source.label + '.' + update.source.src;
        } else if (update.source.type == 'NMEA0183') {
          source = update.source.label + '.' + update.source.talker;
        } else {
          // donno what it is...
          source = update.source.label;
        }
      } else if (update['$source'] !== undefined) {
        source = update['$source'];
      } else if ((update.source !== undefined) && (update.source.src !== undefined) && (update.source.label !== undefined)) {
        source = update.source.label + '.' + update.source.src;
      } else if (update.source.label !== undefined) {
        source = update.source.label;
      } else {
        source = "unknown";
      }

      // process message values
      let timestamp = Date.parse(update.timestamp); //TODO, supposedly not reliable
      for (let value of update.values) {
        if (/^notifications./.test(value.path)) {   // is a notification message, pass to notification service
          this.notifications.processNotificationDelta(value.path, value.value);
        } else {
          // it's a data update. Update local tree
          let fullPath = context + '.' + value.path;
          if (value.path == '') { fullPath = context; } // if path is empty we shouldn't have a . at the end
          if ( (typeof(value.value) == 'object') && (value.value !== null)) {
            // compound data
            let keys = Object.keys(value.value);
            for (let i = 0; i < keys.length; i++) {
              this.signalK.updatePathData(fullPath + '.' + keys[i], source, timestamp, value.value[keys[i]]);
            }
          } else {
            // simple data
            this.signalK.updatePathData(fullPath, source, timestamp, value.value);
          }
        }
      }
    }
  }

  // WebSoocket Stream Status observable
  getDataStreamStatusAsO() {
    return this.streamEndpoint$.asObservable();
  }

  public subscribeRequest(): Observable<IDeltaMessage> {
    return this.signalKRequests.asObservable();
  }

  // Close the WebSocket on app termination. This send a Close to the server for
  // a clean disconnect. Else the server keeps buffering the messages and it creates an
  // overflow that that will eventually have the server kill the connection.
  OnDestroy() {
    this.closeWS();
  }

 }
