import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { isNull } from 'util';

export interface AppNotification {
  message: string;
  duration: number;
}

interface signalKNotification {
  state: string;
  message: string;
  method: string[];
  ack?: boolean;
}

export interface activeAlarms {
  [path: string]: signalKNotification;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  notificationsSubject: Subject<AppNotification> = new Subject<AppNotification>();
  activeAlarmsSubject: BehaviorSubject<activeAlarms> = new BehaviorSubject<activeAlarms>({});

  activeAlarms: activeAlarms = {};

  constructor() { }

  newNotification(message: string, duration: number = 10000) {
    console.log(message);

    this.notificationsSubject.next({ message: message, duration: duration});
  }

  getNotificationObservable() {
    return this.notificationsSubject.asObservable();
  }
  getAlarmObservable() {
    return this.activeAlarmsSubject.asObservable();
  }

  processNotificationDelta(path: string, notif: signalKNotification) {
    if (isNull(notif)) {
      // erase any alarms with path
      if (path in this.activeAlarms) {
        delete this.activeAlarms[path];
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    } else {
      if (path in this.activeAlarms) {
        //already know of this alarm. Just check if updated (no need to update doc/etc if no change)
        if (    (this.activeAlarms[path].state != notif.state)
              ||(this.activeAlarms[path].message != notif.message)
              ||(JSON.stringify(this.activeAlarms[path].method) != JSON.stringify(notif.method)) ) { // no easy way to compare arrays??? ok...
          this.activeAlarms[path] = notif;
          this.activeAlarmsSubject.next(this.activeAlarms);

        }
      } else {
        // new alarm, add it
        this.activeAlarms[path] = notif;
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    }
  }

  // Called when signalk server reset
  resetAlarms() {
    this.activeAlarms = {};
    this.activeAlarmsSubject.next(this.activeAlarms);
  }

}
