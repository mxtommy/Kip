import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LayoutSplitsService } from './layout-splits.service';

import * as screenfull from 'screenfull';

import { AppSettingsService } from './app-settings.service';
import { DataSetService } from './data-set.service';
import { NotificationsService, activeAlarms } from './notifications.service';


declare var NoSleep: any; //3rd party

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  noSleep = new NoSleep();

  pageName: string = '';

  unlockStatus: boolean = false;
  unlockStatusSub: Subscription;

  fullscreenStatus = false;


  themeName: string;
  themeClass: string = 'default-light fullheight';
  themeNameSub: Subscription;

  notificationSub: Subscription;
  alarmSub: Subscription;

  alarms: activeAlarms = {};
  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;

  constructor(
    private AppSettingsService: AppSettingsService,
    private DataSetService: DataSetService,
    private NotificationsService: NotificationsService,
    private _snackBar: MatSnackBar,
    private overlayContainer: OverlayContainer,
    private LayoutSplitsService: LayoutSplitsService) { }


  ngOnInit() {
    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      status => { this.unlockStatus = status; }
    );

    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      newTheme => {
        this.themeClass = newTheme + ' fullheight'; // need fullheight there to set 100%height
        if (this.themeName) {
          this.overlayContainer.getContainerElement().classList.remove(this.themeName);
        }
        this.overlayContainer.getContainerElement().classList.add(newTheme);
        this.themeName = newTheme;
      }
    )
    this.DataSetService.startAllDataSets();
    
    // Snackbar Notification Code
    this.notificationSub = this.NotificationsService.getNotificationObservable().subscribe(
      appNotififaction => {
        this._snackBar.open(appNotififaction.message, 'dismiss', {
          duration: appNotififaction.duration,
          verticalPosition: 'top'
        });
      }
    )
    // Alarm code

    this.alarmSub = this.NotificationsService.getAlarmObservable().subscribe(
      alarms  => {
        this.alarms = alarms;
        this.updateAlarms();
       }
    )

  }

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
    this.themeNameSub.unsubscribe();
    this.notificationSub.unsubscribe();

  }

  setTheme(theme: string) {
    this.AppSettingsService.setThemName(theme);
  }


  unlockPage() {
    if (this.unlockStatus) {
      console.log("Locking");
      this.unlockStatus = false;
    } else {
      console.log("Unlocking");
      this.unlockStatus = true;
    }
    this.AppSettingsService.setUnlockStatus(this.unlockStatus);
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
          break;
        case 1:
          this.blinkWarn = true;
          this.blinkCrit = false;
          break;
        case 2:
          this.blinkCrit = true;
          this.blinkWarn = false;

      }
    } else {
      // no Alarms
      this.blinkWarn = false;
      this.blinkCrit = false;
    }
  }

  ackAlarm(path: string, timeout: number = 0) {
    if (path in this.alarms) {
      this.alarms[path].ack = true;
    }
    if (timeout > 0) {
      setTimeout(()=>{
        console.log(path);
        if (path in this.alarms) {
          this.alarms[path].ack = false;
        }
        this.updateAlarms();
      }, timeout);
    }
    this.updateAlarms();
  }

  newPage() {
    this.LayoutSplitsService.newRootSplit();
      //this.router.navigate(['/page', rootNodes.findIndex(uuid => uuid == newuuid)]);
  }

  pageDown() {
        this.LayoutSplitsService.previousRoot();

  }

  pageUp() {
    this.LayoutSplitsService.nextRoot();

  }

  toggleFullScreen() {
    if (!this.fullscreenStatus) {
      screenfull.request();
      this.noSleep.enable();
    } else {
      if (screenfull.isFullscreen) {
        screenfull.exit();
      }
      this.noSleep.disable();
    }

    this.fullscreenStatus = !this.fullscreenStatus;
  }

}
