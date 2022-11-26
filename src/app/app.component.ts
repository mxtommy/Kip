import { AuththeticationService } from './auththetication.service';
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
import { SignalKDeltaService, IStreamStatus } from './signalk-delta.service';

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
  activeThemeClass: string = 'modern-dark fullheight';
  activeTheme: string;
  themeNameSub: Subscription;

  isNightMode: boolean = false;

  appNotificationSub: Subscription;
  connectionStatusSub: Subscription;

  constructor(
    private _snackBar: MatSnackBar,
    private overlayContainer: OverlayContainer,
    private LayoutSplitsService: LayoutSplitsService, // needs AppSettingsService
    public appSettingsService: AppSettingsService, // needs storage & AppInit
    private DataSetService: DataSetService, // needs AppSettingsService & SignalKService
    private notificationsService: NotificationsService, // needs AppSettingsService SignalKConnectionService
    public auththeticationService: AuththeticationService,
    private deltaService: SignalKDeltaService,
    // below services are needed: first service instanciation after Init Service
    private signalKDeltaService: SignalKDeltaService, // needs SignalKService & NotificationsService & SignalKConnectionService
    ) { }


  ngOnInit() {
    // Page layout area operations sub
    this.unlockStatusSub = this.appSettingsService.getUnlockStatusAsO().subscribe(
      status => { this.unlockStatus = status; }
    );

    // Theme operations sub
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe( newTheme => {
        this.activeThemeClass = newTheme + ' fullheight'; // need fullheight there to set 100%height

        if (!this.themeName) { // first run
          this.themeName = newTheme;
        } else  {
          this.overlayContainer.getContainerElement().classList.remove(this.activeTheme);
        }

        if (!this.isNightMode) {
          if (newTheme !== this.themeName) {
            this.overlayContainer.getContainerElement().classList.add(newTheme);
            this.themeName = newTheme;
          } else {
            this.overlayContainer.getContainerElement().classList.add(this.themeName);
          }
        } else {
          this.overlayContainer.getContainerElement().classList.add(newTheme);
        }
        this.activeTheme = newTheme;
      }
    );

    // Snackbar Notifications sub
    this.appNotificationSub = this.notificationsService.getSnackbarAppNotifications().subscribe(

      appNotification => {
        this._snackBar.open(appNotification.message, 'dismiss', {
          duration: appNotification.duration,
          verticalPosition: 'top'
        });

        if (!this.appSettingsService.getNotificationConfig().sound.disableSound && !appNotification.silent) {
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
    );

    // Connection Status Notification sub
    this.connectionStatusSub = this.deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus) => {
        this.displayConnectionsStatusNotification(status);
      }
    );

    this.DataSetService.startAllDataSets();
  }

  private displayConnectionsStatusNotification(streamStatus: IStreamStatus) {

    switch (streamStatus.operation) {
      case 0: // not connected
        this.notificationsService.sendSnackbarNotification("Not connected to server.", 5000, true);
        break;

      case 1: // connecting
        this.notificationsService.sendSnackbarNotification("Connecting to server.", 2000, true);
       break;

      case 2: // connected
        this.notificationsService.sendSnackbarNotification("Connection successful.", 2000, false);
        break;

      case 3: // connection error
        this.notificationsService.sendSnackbarNotification("Error connecting to server.", 0, false);
        break;

      default:
        this.notificationsService.sendSnackbarNotification("Unknown stream connection status.", 0, false);
        break;
    }
  }

  setTheme(theme: string) {
    this.appSettingsService.setThemName(theme);
  }

  setNightMode(nightMode: boolean) {
    this.isNightMode = nightMode;
    if (this.isNightMode) {
      this.appSettingsService.setThemName("nightMode");
    } else {
      this.appSettingsService.setThemName(this.themeName);
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
    this.appSettingsService.setUnlockStatus(this.unlockStatus);
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

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
    this.themeNameSub.unsubscribe();
    this.appNotificationSub.unsubscribe();
    this.connectionStatusSub.unsubscribe();
  }

}
