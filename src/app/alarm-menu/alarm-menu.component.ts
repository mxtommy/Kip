import { Component, OnInit } from '@angular/core';
import { NotificationsService, activeAlarms } from '../notifications.service';
import { Subscription } from 'rxjs';
import { Howl, Howler} from 'howler';


@Component({
  selector: 'app-alarm-menu',
  templateUrl: './alarm-menu.component.html',
  styleUrls: ['./alarm-menu.component.scss']
})
export class AlarmMenuComponent implements OnInit {

  alarmSub: Subscription;

  alarms: activeAlarms = {};
  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;

  ignoredPaths: string[] = [];

  warningSound;
  critSound;

  constructor(
    private NotificationsService: NotificationsService,
  ) { }

  ngOnInit() {

    this.warningSound = new Howl({
      src: ['assets/alarm-warn.mp3'],
      loop: true,
    });
    this.critSound = new Howl({
      src: ['assets/alarm-crit.mp3'],
      loop: true,
    });
    // Alarm code

    this.alarmSub = this.NotificationsService.getAlarmObservable().subscribe(
      alarms  => {
        this.alarms = alarms;
        this.updateAlarms();
        }
    );
  }


  updateAlarms() {
    this.alarmCount = Object.keys(this.alarms).length;
    this.unAckAlarms = 0;
    this.blinkWarn = false;
    this.blinkCrit = false;
    this.warningSound.stop();
    this.critSound.stop();

    if (this.alarmCount > 0) {
      // find worse alarm state
      let audioSev = 0;
      let visualSev = 0;

      for (const [path, alarm] of Object.entries(this.alarms))
      {
        if (alarm.ack) { continue; }
        if (this.ignoredPaths.includes(path)) { continue; }
        this.unAckAlarms++;
        let aSev = 0;
        let vSev = 0;
        switch (alarm.state) {
          case 'alert':
          case 'warn':
            if (alarm.method.includes('sound')) { aSev = 1; }
            if (alarm.method.includes('visual')) { vSev = 1; }
            break;
          case 'alarm':
          case 'emergency':
            if (alarm.method.includes('sound')) { aSev = 2; }
            if (alarm.method.includes('visual')) { vSev = 2; }
            
        }
        audioSev = Math.max(audioSev, aSev);
        visualSev = Math.max(visualSev, vSev)
      }

      switch(audioSev) {
        case 0:
          this.warningSound.stop();
          this.critSound.stop();
          break;
        case 1:
          this.warningSound.play();
          this.critSound.stop();
          break;
        case 2:
          this.warningSound.stop();
          this.critSound.play();

      }
      switch(visualSev) {
        case 0:
          this.blinkWarn = false;
          this.blinkCrit = false;
          break;
        case 1:
          this.blinkWarn = true;
          this.blinkCrit = false;
          break;
        case 2:
          this.blinkCrit = true;
          this.blinkWarn = false;
     
      }

    } 
  }

  ackAlarm(path: string, timeout: number = 0) {
    if (path in this.alarms) {
      this.alarms[path].ack = true;
    }
    if (timeout > 0) {
      setTimeout(()=>{
        console.log("unack: "+ path);
        if (path in this.alarms) {
          this.alarms[path].ack = false;
        }
        this.updateAlarms();
      }, timeout);
    }
    this.updateAlarms();
  }

  ignoreAlarm(path: string, timeout: number = 0) {
    this.ignoredPaths.push(path);
    this.updateAlarms();
    if (timeout > 0) {
      setTimeout(()=>{
        console.log("unIgnore: "+ path);
        if (this.ignoredPaths.includes(path)) {
          let index = this.ignoredPaths.findIndex(p => (p == path));
          if (index >= 0) {
            this.ignoredPaths.splice(index,1);
          }
        }
        this.updateAlarms();
      }, timeout);
    }

  }

  pathIgnored(path: string) {
    return this.ignoredPaths.includes(path);
  }

}
