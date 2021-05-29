import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService, Alarm } from '../notifications.service';
import { AppSettingsService, INotificationConfig } from '../app-settings.service';
import { Subscription } from 'rxjs';
import { Howl } from 'howler';

// TODO: move Sound feature to service or class and refactor. Will be used by Alarm Menu, Snackbar and Widgets
const alarmTrack = {
  1000 : 'notification', //filler
  1001 : 'alert',
  1002 : 'warn',
  1003 : 'alarm',
  1004 : 'emergency',
};

interface IMenuNode {
  [key: string]: any;
  label: string;
  childNode?: [IMenuItem | IMenuNode];
}
interface IMenuItem {
  [key: string]: any;
  label: string;
  Alarm?: Alarm;
}


@Component({
  selector: 'app-alarm-menu',
  templateUrl: './alarm-menu.component.html',
  styleUrls: ['./alarm-menu.component.scss']
})
export class AlarmMenuComponent implements OnInit, OnDestroy {

  private alarmSub: Subscription;
  private notificationServiceSettings: Subscription;

  alarms: { [path: string]: Alarm };
  notificationAlarms: { [path: string]: Alarm };
  alarmMenu: { [key: string]: string | IMenuItem | IMenuItem } = {}; // local menu array with string key

  // Menu properties
  ignoredPaths: string[] = [];
  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;

  // sounds properties
  howlPlayer: Howl;
  activeAlarmSoundtrack: number;
  activeHowlId: number;
  isHowlIdMuted: boolean = false;

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
        this.notificationAlarms = message;
        // Disabling notifications is done at the service level. No need to handle it here
        this.buildAlarmMenu();
      }
    );
    // init alarm player
    // TODO: move Sound feature to service or class and refactor. Will be used by Alarm Menu, Snackbar and Widgets
    this.howlPlayer = this.getPlayer(1000);
  }

  // we use this as a staging area to limit menu update events we build the menu from Alarms record
  buildAlarmMenu() {
    // clean notificationAlarms based on App Notification settings
    if (!this.notificationConfig.devices.showNormalState) {
      for (const [path, thealarm] of Object.entries(this.notificationAlarms)) {
        let alarm = this.notificationAlarms[path];

        if (alarm.notification['state'] == 'normal' && alarm['type'] == 'device') {
          delete this.notificationAlarms[path];
          break;
        }
      }
    }



    // build menu structure
    // for (const [path, alarm] of Object.entries(this.notificationAlarms)) {

    //   let menuPathsArray = this.notificationAlarms[path].path.split(".");
    //   menuPathsArray.splice(0, 1);

    //   // build object hierarchy
    //   for (let index = 0; index < menuPathsArray.length; index++) {
    //     let thisMenuPath = menuPathsArray[index];

    //     // root items
    //     if (index == 0) {
    //       let rootMenuItem = this.createMenuRootItem(thisMenuPath);

    //       if (rootMenuItem == null) {
    //         // console.log("Do nothing");
    //       } else {
    //         this.alarmMenu[thisMenuPath] = rootMenuItem;
    //         // console.log("Created" + rootMenuItem);
    //       }
    //     } else {
    //       let node = this.createMenuChildItem(thisMenuPath, index, menuPathsArray, alarm);
    //     }

    //   }
    // }
    this.alarms = this.notificationAlarms;
    this.updateMenu();
  }

  createMenuRootItem(itemLabel: string): IMenuNode | null {
    let item: IMenuNode = {
      label: itemLabel
    }

    if(Object.entries(this.alarmMenu).length) {
      let i = Object.keys(this.alarmMenu).indexOf(itemLabel);
      if(i == -1) {
        console.log("Root: " + itemLabel + " not found. Search index: " + i);
        return item;
      } else {
        console.log("Root: " + itemLabel + " found. Search index: " + i);
        console.log(JSON.stringify(Object.values(this.alarmMenu)));
        return null;
      }
    }
    console.log(JSON.stringify(Object.values(this.alarmMenu)));
    return item;
  }

  createMenuChildItem(itemLabel: string, pathPositionIndex: number, pathArray: string[], alarm: Alarm): IMenuItem | IMenuNode {
    let item;

    const lastPosition = pathArray.length - 1;
    let parentLabel = pathArray[pathPositionIndex - 1];
    let indexParentNode = Object.keys(this.alarmMenu).indexOf(pathArray[parentLabel]);

    if (pathPositionIndex != lastPosition) {
      item = {
        label: pathArray[pathPositionIndex],
      }
    } else {
      item = {
        label: pathArray[pathPositionIndex],
        Alarm: alarm,
      }
    }

    for (const [label, menuNode] of Object.entries(this.alarmMenu)) {
        if (label == parentLabel) {
          console.log(JSON.stringify(menuNode));
          menuNode['childNode'] = item;

          if (pathPositionIndex != lastPosition) {
            pathPositionIndex++;
            if (pathPositionIndex != (lastPosition)) {
              item = {
                label: pathArray[pathPositionIndex]
              }
            } else {
              item = {
                label: pathArray[pathPositionIndex],
                Alarm: alarm,
              }
            }
            menuNode['childNode'][0].childNode = item;
          }
        }
      }

    return null;
  }

  // createMenuChildItem(itemLabel: String, pathPositionIndex: number, pathArray: string[]): IMenuItem | IMenuNode | null {

  //   for (const [label, menuItem] of Object.entries(this.alarmMenu)) {
  //     else if (pathPositionIndex > 1 && pathPositionIndex < pathArray.length) {
  //       if (pathArray[pathPositionIndex - 1] == label) {
  //         console.log("Equal: " + pathArray[pathPositionIndex - 1] + " - " + label);
  //         menuItem.childNode = newItem;
  //       } else {
  //         console.log("Different: " + pathArray[pathPositionIndex - 1] + " - " + label);
  //       }
  //     }
  //   }
  //   return newItem;
  // }

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
            if (alarm.notification['method'].includes('visual')) { vSev = 1; }
            break;

          case 'alarm':         // a problem that requires immediate user attention ie.: auto-pilot can't stay on course, engine temp above specs.
            if (alarm.notification['method'].includes('sound')) { aSev = 3; }
            if (alarm.notification['method'].includes('visual')) { vSev = 2; }
            break;

          case 'emergency':     // safety threatening event ie.: MOB, collision eminent (AIS related), ran aground (water depth lower than keel draft)
            if (alarm.notification['method'].includes('sound')) { aSev = 4; }
            if (alarm.notification['method'].includes('visual')) { vSev = 2; }
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
        this.updateMenu();
      }, timeout);
    }
    this.updateMenu();
  }

  ignoreAlarm(path: string, timeout: number = 0) {
    this.ignoredPaths.push(path);
    this.updateMenu();
    if (timeout > 0) {
      setTimeout(()=>{
        console.log("unIgnore: "+ path);
        if (this.ignoredPaths.includes(path)) {
          let index = this.ignoredPaths.findIndex(p => (p == path));
          if (index >= 0) {
            this.ignoredPaths.splice(index,1);
          }
        }
        this.updateMenu();
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
    this.activeHowlId = this.howlPlayer.play();
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
   * mute Howl Player active track ei.: howlId. Note Howl howlId is not the
   * same as Player Soundtrack TrackId which represents the selected sound file.
   * @param state sound muted boolean state
   */
  mutePlayer(state) {
    this.howlPlayer.mute(state, this.activeHowlId);
    this.isHowlIdMuted = state;
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
