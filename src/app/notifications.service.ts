/**
 * This class handles both App notifications Snackbar and SignalK Notifications
 */
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { SignalKNotification } from "./signalk-interfaces";
import { isNull } from 'util';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
}

/**
 * Kip Alarm object. Alarm index key is the path string. Alarm contains native SignalK Notification
 * values in and additional feature enhancing alarm properties.
 *
 * @path SignalK alarm path - Defines source of the alarm
 * @ack Optional Alarm acknowledgment property
 * @notification Native SignalK Notification message as Object SignalKNotification
 */
export interface Alarm {
  path: string;
  ack?: boolean;
  notification: SignalKNotification;
}


@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private alarms: { [path: string]: Alarm } = {}; // local array of Alarms with path as index key
  private activeAlarmsSubject = new BehaviorSubject<any>({});
  public snackbarAppNotifications: Subject<AppNotification> = new Subject<AppNotification>(); // for snackbar message

  constructor( ) { }

  /**
   * Display Kip Snackbar notification.
   *
   * @param message Text to be displayed.
   * @param duration Display duration in milliseconds before automatic dismissal.
   * Duration value of 0 is indefinite or until use clicks Dismiss button. Defaults
   *  to 10000 of no value is provided.
   */
  sendSnackbarNotification(message: string, duration: number = 10000) {
    this.snackbarAppNotifications.next({ message: message, duration: duration});
  }

  public listAlarms() {}

  /**
   * Clears all Kip internal Notification Alarm system/array.
   * Used when server connection is reset or changed and the Kip app state
   * must be restored fresh.
   *
   * @usageNotes Internal function - Do not use.
   */
  public resetAlarms() {
    this.alarms = {};
    this.activeAlarmsSubject.next(this.alarms);
  }

  public subscribeAlarms() {}
  public unsubscribeAlarms() {}

  /**
   * Returns an Observable of type alarms containing alarms. Used
   * by observers whom are interested in Alarms such as Widgets and Alarm menu.
   */
  public getAlarms(): Observable<any> {
    return this.activeAlarmsSubject.asObservable();
  }

  /**
   * Add new Alarm and send
   * @param path SignalK path of the notification
   * @param notification Content of the notification as SignalKNotification
   */
  public addAlarm(path: string, notification: SignalKNotification) {
    let newAlarm: Alarm = {
      path: path,         // duplicate from Alarm Object key index for added scope from individual alarm scope
      notification: notification,
      ack: false,
    };
    this.alarms[path] = newAlarm;
    this.activeAlarmsSubject.next(this.alarms);
  }

  /**
   * Update Alarm notification data (data from SignalK) only. ie. alarm.notification
   * @param path
   * @param notification
   */
  public updateAlarm(path: string, notification: SignalKNotification) {
    this.alarms[path].notification = notification;
    this.activeAlarmsSubject.next(this.alarms);
  }

  /**
  * Deletes one alarm and notifies all observers
  * @param path String path for the alarm to delete
  * @return True If path exists, false if not found.
  */
  public deleteAlarm(path: string): boolean {
    if (path in this.alarms) {
      delete this.alarms[path];
      this.activeAlarmsSubject.next(this.alarms);
      return true;
    }
    return false;
  }

  public acknowledgeAlarm() {}
  public muteAlarm() {}

  /**
   * Observable to receive Kip app Snackbar notification. Use in app.component ONLY.
   *
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
 *
 * @param path path of message ie. the subject of the message
 * @param notificationValue Content of the message. Must conform to SignalKNotification interface.
 * @usageNotes This function is internal and should not be used.
 */
  public processNotificationDelta(path: string, notificationValue: SignalKNotification) {
    if (isNull(notificationValue)) {
      // Alarm removed/cleared on server.
      if (this.deleteAlarm(path)) {};
    } else {
      if (path in this.alarms) {
        //already know of this alarm. Just check if updated (no need to update doc/etc if no change)
        if (    (this.alarms[path].notification['state'] != notificationValue['state'])
              ||(this.alarms[path].notification['message'] != notificationValue['message'])
              ||(JSON.stringify(this.alarms[path].notification['method']) != JSON.stringify(notificationValue['method'])) ) { // no easy way to compare arrays??? ok...
          this.updateAlarm(path, notificationValue);
        }
      } else {
        // New Alarm, send it
        this.addAlarm(path, notificationValue);
      }
    }
  }

}
