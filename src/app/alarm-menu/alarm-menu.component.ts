import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService, Alarm } from '../notifications.service';
import { AppSettingsService, INotificationConfig } from '../app-settings.service';
import { Subscription } from 'rxjs';
import { Howl } from 'howler';

const alarmTrack = {
  1000 : 'notification', //filler
  1001 : 'alert',
  1002 : 'warn',
  1003 : 'alarm',
  1004 : 'emergency',
};

@Component({
  selector: 'app-alarm-menu',
  templateUrl: './alarm-menu.component.html',
  styleUrls: ['./alarm-menu.component.scss']
})
export class AlarmMenuComponent implements OnInit, OnDestroy {

  alarmSub: Subscription;
  private notificationServiceSettings: Subscription;

  alarms: { [path: string]: Alarm };
  alarmsStream: { [path: string]: Alarm };

  ignoredPaths: string[] = [];

  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;
  howlPlayer: Howl;
  activeAlarmSoundtrack: number;

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
    // init Alarm stream
    this.alarmSub = this.notificationsService.getAlarms().subscribe(
      message => {
        this.alarmsStream = message;
        this.updateAlarms();
      }
    );
    // init alarm player
    this.howlPlayer = this.getPlayer(1000);
  }

  updateAlarms() {
    // we use this as a staging area to limit menu update events when we play to the Alarms record
    if (!this.notificationConfig.devices.showNormalState) {
      for (const [path, alarm] of Object.entries(this.alarmsStream)) {
        let alarm = this.alarmsStream[path];

        if (alarm.notification['state'] == 'normal' && alarm.notification['type'] == 'device') {
          delete this.alarmsStream[path];
          break;
        }
      }
    }
    this.alarms = this.alarmsStream;
    this.updateMenu();
  }

  /**
   * main menu management function.
   */
  updateMenu() {
    this.alarmCount = Object.keys(this.alarms).length;
    this.unAckAlarms = 0;
    this.blinkWarn = false;
    this.blinkCrit = false;

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
          //case 'nominal':       // not sure yet... spec not clear. Maybe only relevant for Zones
          case 'normal':        // information only ie.: engine temperature normal. Not usually displayed
            if (alarm.notification['method'].includes('sound')) { aSev = 0; }
            if (alarm.notification['method'].includes('visual')) { aSev = 0; }
            break;

          case 'alert':         // user informational event ie.: auto-pilot waypoint reached, Engine Started/stopped, ect.
            if (alarm.notification['method'].includes('sound')) { aSev = 1; }
            if (alarm.notification['method'].includes('visual')) { vSev = 1; }
            break;

          case 'warn':          // user attention needed ie.: auto-pilot detected Wind Shift (go check if it's all fine), bilge pump activated (check if you have an issue).
            if (alarm.notification['method'].includes('sound')) { aSev = 2; }
            if (alarm.notification['method'].includes('visual')) { vSev = 2; }
            break;

          case 'alarm':         // a problem that requires immediate user attention ie.: auto-pilot can't stay on course, engine temp above specs.
            if (alarm.notification['method'].includes('sound')) { aSev = 3; }
            if (alarm.notification['method'].includes('visual')) { vSev = 3; }
            break;

          case 'emergency':     // safety threatening event ie.: MOB, collision eminent (AIS related), ran aground (water depth lower than keel draft)
            if (alarm.notification['method'].includes('sound')) { aSev = 4; }
            if (alarm.notification['method'].includes('visual')) { vSev = 4; }
            break;

          default: // we don;t know this one. Tell the user.
            aSev = 0;
            vSev = 0;
            this.notificationsService.sendSnackbarNotification("Unknown Notification State received from SignalK", 0);
            console.log("Unknown Notification State received from SignalK\n" + JSON.stringify(alarm));
        }
        audioSev = Math.max(audioSev, aSev);
        visualSev = Math.max(visualSev, vSev);
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
      if (!this.notificationConfig.sound.disableSound) {
        this.playAlarm(1000 + audioSev);
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
   * play audio notification sound
   * @param trackId track to play
   */
  playAlarm(trackId: number) {
    if (this.activeAlarmSoundtrack == trackId) {   // same track, do nothing
      return;
    }

    if (trackId == 1000) {   // Stop track
      this.howlPlayer.stop();
      return;
    }

    this.howlPlayer.stop();
    this.howlPlayer = this.getPlayer(trackId);
    this.howlPlayer.play();
  }

  /**
   * Load player with a specific track in loop mode.
   * @param track track ID to play. See const for definition
   */
  getPlayer(track: number): Howl {
    this.activeAlarmSoundtrack = track;
    let player = new Howl({
        src: ['assets/' + alarmTrack[track] + '.mp3'],
        autoUnlock: true,
        autoSuspend: false,
        autoplay: false,
        preload: true,
        loop: true,
        onend: function() {
          // console.log('Finished!');
        },
        onloaderror: function() {
          console.log("player onload error");
        },
        onplayerror: function() {
          console.log("player locked");
          this.howlPlayer.once('unlock', function() {
            this.howlPlayer.play();
          });
        }
      });
    return player;
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
