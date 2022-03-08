import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Howl } from 'howler';
import { LayoutSplitsService } from './layout-splits.service';
import * as screenfull from 'screenfull';

import { AppSettingsService } from './app-settings.service';
import { DataSetService } from './data-set.service';
import { NotificationsService } from './notifications.service';
import { SignalKConnectionService, SignalKStatus } from './signalk-connection.service';

declare var NoSleep: any; //3rd party

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  noSleep = new NoSleep();

  pageName: string = '';

  unlockStatus: boolean = false;
  unlockStatusSub: Subscription;

  fullscreenStatus = false;

  themeName: string;
  themeClass: string = 'modern-dark fullheight';
  themeNameSub: Subscription;

  isNightMode: boolean = false;

  appNotificationSub: Subscription;
  connectionStatusSub: Subscription;

  constructor(
    private AppSettingsService: AppSettingsService,
    private DataSetService: DataSetService,
    private notificationsService: NotificationsService,
    private _snackBar: MatSnackBar,
    private overlayContainer: OverlayContainer,
    private LayoutSplitsService: LayoutSplitsService,
    private signalKConnectionService: SignalKConnectionService,
    ) { }


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
    this.appNotificationSub = this.notificationsService.getSnackbarAppNotifications().subscribe(

      appNotification => {
        this._snackBar.open(appNotification.message, 'dismiss', {
          duration: appNotification.duration,
          verticalPosition: 'top'
        });

        if (!this.AppSettingsService.getNotificationConfig().sound.disableSound) {
          let sound = new Howl({
            src: ['assets/notification.mp3'],
            autoUnlock: true,
            autoSuspend: false,
            autoplay: true,
            preload: true,
            loop: false,
            volume: 0.3,
            onend: function() {
              // console.log('Finished!');
            },
            onloaderror: function() {
              console.log("snackbar: player onload error");
            },
            onplayerror: function() {
              console.log("snackbar: player locked");
              this.howlPlayer.once('unlock', function() {
                this.howlPlayer.play();
              });
            }
          });
          sound.play();
        }
      }
    )

    // Connection Status Notification sub
    this.connectionStatusSub = this.signalKConnectionService.getSignalKConnectionsStatus().subscribe(
      status => {
        this.displayConnectionsStatusNotification(status);
      }
    );


  }

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
    this.themeNameSub.unsubscribe();
    this.appNotificationSub.unsubscribe();
    this.connectionStatusSub.unsubscribe();
  }

  displayConnectionsStatusNotification(connectionsStatus: SignalKStatus) {
    if (connectionsStatus.operation == 1) { // starting server
      if (!connectionsStatus.endpoint.status) {
        this.notificationsService.sendSnackbarNotification(connectionsStatus.endpoint.message, 5000);
      } else {
        this.notificationsService.sendSnackbarNotification("Connected to SignalK Server.", 5000);
      }
    }
    if (connectionsStatus.operation == 3) { // URL changed/reset
      this.notificationsService.sendSnackbarNotification("Connection Update/Reset successful.", 5000);
    }
  }

  setTheme(theme: string) {
    this.AppSettingsService.setThemName(theme);
  }

  setNightMode(nightMode: boolean) {
    this.isNightMode = nightMode;
    if (this.isNightMode) {
      this.AppSettingsService.setThemName("nightMode");
    } else {
      this.AppSettingsService.setThemName(this.AppSettingsService.getThemeName());
    }
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
    if (screenfull.isEnabled) {
      if (!this.fullscreenStatus) {
        screenfull.request();
        this.noSleep.enable();
      } else {
        if (screenfull.isFullscreen) {
          screenfull.exit();
        }
        this.noSleep.disable();
      }
    }
    this.fullscreenStatus = !this.fullscreenStatus;
  }

}
