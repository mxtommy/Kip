import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface AppNotification {
  message: string;
  duration: number;
}


@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  notifications: Subject<AppNotification> = new Subject<AppNotification>();
  constructor() { }

  newNotification(message: string, durtion: number = 10000) {
    console.log(message);
    
    this.notifications.next({ message: message, duration: durtion});
  }

  getObservable() {
    return this.notifications.asObservable();
  }

}
