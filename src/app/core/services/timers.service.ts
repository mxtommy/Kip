import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';


interface IKipTimer {
  currentValue: BehaviorSubject<number>;
  timeoutID: ReturnType<typeof setInterval> | null;
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

  /**
   * Create service timer. The timer notification schedules is based on the timerInterval value and
   * the number of count to apply. Adjust the interval according to the use case and reduce
   * unnecessary app events. A timerInterval of 1000 ms with count of 60 is 60 * 1000ms =
   * 1 minutes and would generate a Subject event and Observer processing every second.
   *
   * @param {string} timerName Used as the ID id the timer
   * @param {number} count Number of steps to execute. This number is a factor of timerInterval. Use negative values to countdown
   * @param {number} timerInterval Count interval in milliseconds
   * @return {*}  {Observable<number>} Timer count value as a number
   * @memberof TimersService
   */
  public createTimer(timerName: string, count: number, timerInterval: number): Observable<number> {
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



  public startTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }

    if (this.kipTimers[timerName].timeoutID !== null) { return } // already running

    this.kipTimers[timerName].timeoutID = setInterval(() => {
      this.kipTimers[timerName].currentValue.next(this.kipTimers[timerName].currentValue.value + 1)
    }, this.kipTimers[timerName].intervalMS);
  }

  public stopTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    if (this.kipTimers[timerName].timeoutID === null) { return; } // already Stopped
    clearInterval(this.kipTimers[timerName].timeoutID);
    this.kipTimers[timerName].timeoutID = null;
  }


  public setTimer(timerName: string, timerValue: number) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    this.kipTimers[timerName].currentValue.next(timerValue);
  }


  public deleteTimer(timerName: string) {
    if (!this.kipTimers.hasOwnProperty(timerName)) { return; }
    this.stopTimer(timerName);
    this.kipTimers[timerName].currentValue.complete();
    delete this.kipTimers[timerName];
  }


  public isRunning(timerName: string) : boolean {
    let running: boolean = false;
    if (timerName in this.kipTimers) {
      running = this.kipTimers[timerName].timeoutID === null ? false : true;
    };

    return running;
  }


}
