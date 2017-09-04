import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';



export class appSettings {
  
}


@Injectable()
export class AppSettingsService {


  signalKUrl: BehaviorSubject<string> = new BehaviorSubject<string>('http://demo.signalk.com/signalk');
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  
  constructor() { }

  // SignalKURL
  getSignalKURLAsO() {
    return this.signalKUrl.asObservable();
  }
  getSignalKURL() {
    return this.signalKUrl.getValue();
  }
  setSignalKURL(value) {
    this.signalKUrl.next(value);
  }

  // UnlockStatus
  getUnlockStatusAsO() {
    return this.unlockStatus.asObservable();
  }
  setUnlockStatus(value) {
    this.unlockStatus.next(value);
  }


}
