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

    if (this.alarmCount > 0) {
      // find worse alarm state
      let sev = 0;

      for (const [path, alarm] of Object.entries(this.alarms))
      {
        if (alarm.ack) { continue; }
        let aSev = 0;
        switch (alarm.state) {
          case 'alert':
          case 'warn':
            aSev = 1;
            this.unAckAlarms++;
            break;
          case 'alarm':
          case 'emergency':
            aSev = 2;
            this.unAckAlarms++;
        }
        if (aSev > sev) { sev = aSev; }
      }

      switch(sev) {
        case 0:
          this.blinkWarn = false;
          this.blinkCrit = false;
          this.warningSound.stop();
          this.critSound.stop();
          break;
        case 1:
          this.blinkWarn = true;
          this.blinkCrit = false;
          this.warningSound.play();
          this.critSound.stop();
          break;
        case 2:
          this.blinkCrit = true;
          this.blinkWarn = false;
          this.warningSound.stop();
          this.critSound.play();

      }
    } else {
      // no Alarms
      this.blinkWarn = false;
      this.blinkCrit = false;
      this.warningSound.stop();
      this.critSound.stop();
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

}
