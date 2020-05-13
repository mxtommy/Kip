import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService, Alarm } from '../notifications.service';
import { AppSettingsService, INotificationConfig } from '../app-settings.service';
import { Subscription } from 'rxjs';
import { Howl } from 'howler';


@Component({
  selector: 'app-alarm-menu',
  templateUrl: './alarm-menu.component.html',
  styleUrls: ['./alarm-menu.component.scss']
})
export class AlarmMenuComponent implements OnInit, OnDestroy {

  alarmSub: Subscription;
  notificationServiceSettings: Subscription;

  notificationDisabled: boolean;
  alarms: { [path: string]: Alarm };
  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;

  ignoredPaths: string[] = [];

  warningSound;
  critSound;
  notificationConfig: INotificationConfig;

  constructor(
    private notificationsService: NotificationsService,
    private appSettingsService: AppSettingsService,
  ) {
    this.notificationServiceSettings = appSettingsService.getNotificationConfigService().subscribe(config => {
      this.notificationConfig = config;
    });
  }

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

    this.alarmSub = this.notificationsService.getAlarms().subscribe(
      message  => {
        this.alarms = message; //TODO: Use observer filters and variables
        this.updateAlarms();
      }
    );
  }

  /**
   * main alert management function. Called on Observable message
   */
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
        if (alarm.isAck) { continue; }
        if (this.ignoredPaths.includes(path)) { continue; }
        this.unAckAlarms++;
        let aSev = 0;
        let vSev = 0;

        switch (alarm.notification['state']) {
          case 'alert':
          case 'warn':
            if (alarm.notification['method'].includes('sound')) { aSev = 1; }
            if (alarm.notification['method'].includes('visual')) { vSev = 1; }
            break;
          case 'alarm':
          case 'emergency':
            if (alarm.notification['method'].includes('sound')) { aSev = 2; }
            if (alarm.notification['method'].includes('visual')) { vSev = 2; }

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
      this.alarms[path].isAck = true;
    }
    if (timeout > 0) {
      setTimeout(()=>{
        console.log("unack: "+ path);
        if (path in this.alarms) {
          this.alarms[path].isAck = false;
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

  /**
   * Used by ngFor to tracks alarm items by key for menu optimization
   * @param alarm object in question
   */
  trackAlarmPath(index, alarm) {
    return alarm ? alarm.value.path : undefined;
  }

  ngOnDestroy() {
    this.notificationServiceSettings.unsubscribe();
    this.alarmSub.unsubscribe();
  }

}
