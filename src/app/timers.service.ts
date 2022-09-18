import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';


interface IKipTimer {
  currentValue: BehaviorSubject<number>;
  timeoutID: ReturnType<typeof setInterval>|null;
  intervalMS: number;
}

interface IKipTimers {
  [key: string]: IKipTimer;
}

@Injectable({
  providedIn: 'root'
})
export class TimersService {

  kipTimers: IKipTimers = {};

  constructor() { 
    
  }

  createTimer(timerName: string, count: number, timerInterval: number): Observable<number> {
    // return if exists
    if (timerName in this.kipTimers) {
      return this.kipTimers[timerName].currentValue.asObservable();
    }
    // create it
    this.kipTimers[timerName] = {
      currentValue: new BehaviorSubject<number>(count),
      timeoutID: null,
      intervalMS: timerInterval
    }
    return this.kipTimers[timerName].currentValue.asObservable();
  }


  startTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    
    if (this.kipTimers[timerName].timeoutID !== null) { return ; } // already running

    this.kipTimers[timerName].timeoutID = setInterval(()=>{
      this.kipTimers[timerName].currentValue.next(this.kipTimers[timerName].currentValue.value + 1)
    }, this.kipTimers[timerName].intervalMS);
    
  }

  stopTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    if (this.kipTimers[timerName].timeoutID === null) { return; } // already Stopped
    clearInterval(this.kipTimers[timerName].timeoutID);
    this.kipTimers[timerName].timeoutID = null;
  }


  setTimer(timerName: string, timerValue: number) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    this.kipTimers[timerName].currentValue.next(timerValue);
  }


  deleteTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    this.stopTimer(timerName);
    delete this.kipTimers[timerName];
  }

}
