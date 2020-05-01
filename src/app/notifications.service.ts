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

  newNotification(message: string, durtion: number = 10000) {
    console.log(message);

    this.notificationsSubject.next({ message: message, duration: durtion});
  }

  getNotificationObservable() {
    // return this.notificationsSubject.asObservable();
    return null;
  }
  getAlarmObservable() {
    // return this.activeAlarmsSubject.asObservable();
    return null;
  }

  processNotificationDelta(path: string, notif: signalKNotification) {
    if (isNull(notif)) {
      // erase any alarms with path
      if (path in this.activeAlarms) {
        delete this.activeAlarms[path];
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    } else {
      this.activeAlarms[path] = notif;
      this.activeAlarmsSubject.next(this.activeAlarms);
    }
    //console.log(this.activeAlarms);
  }

  // Called when signalk server reset
  resetAlarms() {
    this.activeAlarms = {};
    this.activeAlarmsSubject.next(this.activeAlarms);
  }

}
