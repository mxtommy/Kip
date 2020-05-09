/**
 * This class handles both App alarms, alerts, and notifications message
 */
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { isNull } from 'util';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
}
// displayScale type restriction
const types = ["linear", "logarithmic", "squareroot", "power"] as const;
type Type = typeof types[number];

// alert methods restriction
const methods = ["visual", "sound"] as const;
type Method = typeof methods[number];

/**
 * SignalK Notification Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/data_model_metadata.html
 * Kip additional fields
 * @param state ???
 * @param message ???
 * @param ack ??
 */
export interface SignalKNotification {
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
  alertMethod?: Method[];
  warnMethod?: Method[];
  alarmMethod?: Method[];
  emergencyMethod?: Method[];
  zones?: string;

  state: string;
  message: string;
  method: Method[];
  ack?: boolean;
}
/**
 * Array of active alarms. Contains alarm paths and SignalK notification object details
 */
export interface ActiveAlarms {
  [path: string]: SignalKNotification;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  notificationsSubject: Subject<AppNotification> = new Subject<AppNotification>(); // for snackbar message
  private activeAlarmsSubject: BehaviorSubject<ActiveAlarms> = new BehaviorSubject<ActiveAlarms>({}); // for alarms

  private activeAlarms: ActiveAlarms = {}; // local array of Alarms

  constructor() {

  }
  /**
 * Display Kip Snackbar notification.
 * @param message Text to be displayed.
 * @param duration Display duration in milliseconds before automatic dismissal. Duration value of 0 is indefinite or until use clicks Dismiss button. Defaults to 10000 of no value is provided.
 */
  newNotification(message: string, duration: number = 10000) {
    console.log(message);

    this.notificationsSubject.next({ message: message, duration: duration});
  }

  public listAlarms() {}
    /**
   * Clears all Kip internal Notification Alarm system/array.
   * Used when server connection is reset or changed and the Kip app state
   * must be restored fresh.
   * @usageNotes Internal function - Do not use.
   */
  public resetAlarms() {
    this.activeAlarms = {};
    this.activeAlarmsSubject.next(this.activeAlarms);
  }

  public subscribeAlarm() {}
  public unsubscribeAlarm() {}

  public getAlarm() {}
  public sendAlarm() {}

  public acknowledgeAlarm() {}
  public muteAlarm() {}
  public clearAlarm() {}


  /**
   * Observable to submit snackbar notification. Use in app.component root only as
   * Kip Snackbar Notifications handling should be centralized.
   * @usageNotes To submit a notification to the snackbar, use newNotification().
   * Notifications are purely client side and have no relation or
   * interaction with the SignalK server.
   */
  public getNotificationObservable() {
    return this.notificationsSubject.asObservable();
  }
  /**
   * Observable to Alarm notification. Use by observers whom are interested in Alarms
   * such as Widgets and Alarm menu.
   */
  public getAlarmObservable() {
    return this.activeAlarmsSubject.asObservable();
  }
/**
 * Processes SignalK Delta metadata containing Notifications information and
 * routes to Kip Notification system as Alarms and Notifications.
 * @param path path of message ie. the subject of the message
 * @param notificationValue Content of the message. Must conform to SignalKNotification interface.
 * @usageNotes This function is internal and should not be used.
 */
  public processNotificationDelta(path: string, notificationValue: SignalKNotification) {
    // return null; // TODO(David): remove temp disable

    // TODO(david): deal with = When an alarms is removed, a delta should be sent to subscribers with the path and a null value.
    if (isNull(notificationValue)) {
      // Cleanup any alarms with this path
      if (path in this.activeAlarms) {
        delete this.activeAlarms[path];
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    } else {
      if (path in this.activeAlarms) {
        //already know of this alarm. Just check if updated (no need to update doc/etc if no change)
        if (    (this.activeAlarms[path].state != notificationValue.state)
              ||(this.activeAlarms[path].message != notificationValue.message)
              ||(JSON.stringify(this.activeAlarms[path].method) != JSON.stringify(notificationValue.method)) ) { // no easy way to compare arrays??? ok...
          this.activeAlarms[path] = notificationValue;
          this.activeAlarmsSubject.next(this.activeAlarms);

        }
      } else {
        // new alarm, add it and send
        this.activeAlarms[path] = notificationValue;
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    }
  }

}
