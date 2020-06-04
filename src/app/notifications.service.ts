/**
 * This class handles both App notifications Snackbar and SignalK Notifications
 */
import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { ISignalKNotification } from "./signalk-interfaces";
import { AppSettingsService, INotificationConfig } from "./app-settings.service";
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
 * @notification Native SignalK Notification message as Object ISignalKNotification
 */
export interface Alarm {
  path: string;
  type: string;
  isAck: boolean;
  isMuted: boolean;
  notification: ISignalKNotification;
}


@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationServiceSettings: Subscription;
  private notificationConfig: INotificationConfig;

  private alarms: { [path: string]: Alarm } = {}; // local array of Alarms with path as index key
  private activeAlarmsSubject = new BehaviorSubject<any>({});
  public snackbarAppNotifications: Subject<AppNotification> = new Subject<AppNotification>(); // for snackbar message

  constructor(
    private appSettingsService: AppSettingsService,
    ) {
    // Observe Notification configuration
    this.notificationServiceSettings = appSettingsService.getNotificationConfigService().subscribe(config => {
      this.notificationConfig = config;
      if (this.notificationConfig.disableNotifications) {
        this.resetAlarms();
      }
    });
   }

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

  public subscribeAlarms() {}
  public unsubscribeAlarms() {}
  public listAlarms() {}

  /**
   * Clears all Kip internal Notification Alarm system/array.
   * Used when server connection is reset/changed or the notification disabled.
   *
   * @usageNotes Internal function - Do not use.
   */
  public resetAlarms() {
    this.alarms = {};
    this.activeAlarmsSubject.next(this.alarms);
  }

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
   * @param notification Raw content of the notification message from SignalK server as ISignalKNotification
   */
  public addAlarm(path: string, notification: ISignalKNotification) {
    let newAlarm: Alarm = {
      path: path,         // duplicate from Alarm Object key index for added scope from individual alarm context
      type: "device",
      isAck: false,
      isMuted: false,
      notification: notification,
    };
    if (/^notifications.security./.test(path)) {
      return; // as per sbender this part is not ready in the spec - Don't add to alarms
    }
    this.alarms[path] = newAlarm;
    this.activeAlarmsSubject.next(this.alarms);
  }

  /**
   * Update Alarm notification data (data from SignalK) only. ie. alarm.notification
   * @param path
   * @param notification
   */
  public updateAlarm(path: string, notification: ISignalKNotification) {
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

  /**
   * Set Acknowledgement and send to other observers so they can react accordingly
   * @param path alarm to acknowledge
   * @return true of alarms found, else false
   */
  public acknowledgeAlarm(path: string): boolean {
    if (path in this.alarms) {
      this.alarms[path].isAck = true;
      this.activeAlarmsSubject.next(this.alarms);
      return true;
    }
    return false;
  }

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
 * @param notificationValue Content of the message. Must conform to ISignalKNotification interface.
 * @usageNotes This function is internal and should not be used.
 */
  public processNotificationDelta(path: string, notificationValue: ISignalKNotification) {
    if (this.notificationConfig.disableNotifications) {
      return;
    }

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
