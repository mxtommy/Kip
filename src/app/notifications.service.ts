/**
 * This class handles both App alarms, alerts, and notifications message
 */
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { isNull } from 'util';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
}

// alarm state type restriction
const states = ["normal", "warn", "alert", "alarm", "emergency"] as ["normal", "warn", "alert", "alarm", "emergency"];
type State = typeof states[number];


// displayScale type restriction
const types = ["linear", "logarithmic", "squareroot", "power"] as ["linear", "logarithmic", "squareroot", "power"];
type Type = typeof types[number];

// alert methods restriction
const methods = ["visual", "sound"] as ["visual", "sound"];
type Method = typeof methods[number];

/**
 * SignalK Notification Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/data_model_metadata.html
 * Kip additional fields
 * @param state alarms state ie: normal, alert, alarm, emergency
 * @param message ???
 * @param ack ??
 */
export interface SignalKNotification {
  // normal state value
  state: State;
  message: string;
  method: Method[];
  // meta?????
  description?: string;
  displayName?: string;
  longName?: string;
  shortName?: string;
  timeout?: number;
  displayScale?: {
    lower: number;
    upper: number;
    type: Type;
  }
  // elevated state value
  alertMethod?: Method[];
  warnMethod?: Method[];
  alarmMethod?: Method[];
  emergencyMethod?: Method[];
  zones?: []
  ack?: boolean;
}
/**
 * Array of active alarms. Contains alarm paths and SignalK notification object details
 */
export interface Alarm {
  [path: string]: SignalKNotification;
}


@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  public snackbarAppNotifications: Subject<AppNotification> = new Subject<AppNotification>(); // for snackbar message
  private activeAlarmsSubject: BehaviorSubject<Alarm> = new BehaviorSubject<Alarm>({}); // for alarms
  private alarms: Alarm = {}; // local array of Alarms


  constructor( ) { }

    /**
   * Display Kip Snackbar notification.
   * @param message Text to be displayed.
   * @param duration Display duration in milliseconds before automatic dismissal. Duration value of 0 is indefinite or until use clicks Dismiss button. Defaults to 10000 of no value is provided.
   */
    sendSnackbarNotification(message: string, duration: number = 10000) {
    this.snackbarAppNotifications.next({ message: message, duration: duration});
  }

  public listAlarms() {}

    /**
   * Clears all Kip internal Notification Alarm system/array.
   * Used when server connection is reset or changed and the Kip app state
   * must be restored fresh.
   * @usageNotes Internal function - Do not use.
   */
  public resetAlarms() {
    this.alarms = {};
    this.activeAlarmsSubject.next(this.alarms);
  }

  public subscribeAlarm() {}
  public unsubscribeAlarm() {}

  /**
   *  returns an Observable of type alarms containing alarms. Used
   * by observers whom are interested in Alarms such as Widgets and Alarm menu.
   */
  public getAlarms(): Observable<Alarm> {
    return this.activeAlarmsSubject.asObservable();
  }

  public sendAlarm(path: string, value: SignalKNotification) {
    this.alarms[path] = value;
    this.activeAlarmsSubject.next(this.alarms);
  }

  public acknowledgeAlarm() {}
  public muteAlarm() {}

  /*
  * removes one alarm
  */
  public clearAlarm(path: string) {
    if (path in this.alarms) {
      delete this.alarms[path];
      this.activeAlarmsSubject.next(this.alarms);
    }
  }


  /**
   * Observable to receive Kip app Snackbar notification. Use in app.component ONLY.
   * @usageNotes To send a Snackbar notification, use sendSnackbarNotification().
   * Notifications are purely client side and have no relationship or
   * interactions with the SignalK server.
   */
  public getSnackbarAppNotifications() {
    return this.snackbarAppNotifications.asObservable();
  }

/**
 * Processes SignalK Delta metadata containing Notifications information and
 * routes to Kip Notification system as Alarms and Notifications.
 * @param path path of message ie. the subject of the message
 * @param notificationValue Content of the message. Must conform to SignalKNotification interface.
 * @usageNotes This function is internal and should not be used.
 */
  public processNotificationDelta(path: string, notificationValue: SignalKNotification) {
    if (isNull(notificationValue)) {
      // Alarm removed/cleared on server.
      this.clearAlarm(path);
    } else {
      if (path in this.alarms) {
        //already know of this alarm. Just check if updated (no need to update doc/etc if no change)
        if (    (this.alarms[path].state != notificationValue.state)
              ||(this.alarms[path].message != notificationValue.message)
              ||(JSON.stringify(this.alarms[path].method) != JSON.stringify(notificationValue.method)) ) { // no easy way to compare arrays??? ok...

          this.sendAlarm(path, notificationValue);
        }
      } else {
        // new alarm, add it and send
        this.sendAlarm(path, notificationValue);
      }
    }
  }

}
