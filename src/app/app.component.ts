import { AuthenticationService } from './core/services/authentication.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Howl } from 'howler';
import { LayoutSplitsService } from './core/services/layout-splits.service';
import screenfull from 'screenfull';

import { AppSettingsService } from './core/services/app-settings.service';
import { DatasetService } from './core/services/data-set.service';
import { NotificationsService } from './core/services/notifications.service';
import { SignalKDeltaService, IStreamStatus } from './core/services/signalk-delta.service';
import { AppService } from './core/services/app-service';
import { NgIf } from '@angular/common';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatButton } from '@angular/material/button';
import { AlarmMenuComponent } from './alarm-menu/alarm-menu.component';
import { RouterOutlet, RouterLink } from '@angular/router';

declare var NoSleep: any; //3rd party

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [RouterOutlet, AlarmMenuComponent, MatButton, MatMenuTrigger, MatMenu, MatMenuItem, RouterLink, NgIf]
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
    private DatasetService: DatasetService, // needs AppSettingsService & SignalKService
    private notificationsService: NotificationsService, // needs AppSettingsService SignalKConnectionService
    public authenticationService: AuthenticationService,
    private deltaService: SignalKDeltaService,
    private appService: AppService,
    // below services are needed: first service instantiation after Init Service
    private signalKDeltaService: SignalKDeltaService, // needs SignalKService & NotificationsService & SignalKConnectionService
    ) {}


  ngOnInit() {
    // Connection Status Notification sub
    this.connectionStatusSub = this.deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus) => {
      this.displayConnectionsStatusNotification(status);
      }
    );

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

        if (newTheme != 'nightMode') {
          this.isNightMode = false;
          if (newTheme !== this.themeName) {
            this.overlayContainer.getContainerElement().classList.add(newTheme);
            this.themeName = newTheme;
          } else {
            this.overlayContainer.getContainerElement().classList.add(this.themeName);
          }
        } else {
          this.overlayContainer.getContainerElement().classList.add(newTheme);
          this.isNightMode = true;
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
          const sound = new Howl({
            src: ['assets/notification.mp3'],
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
          Howler.autoUnlock = true;
          Howler.autoSuspend = false;
        }
      }
    );
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

  public onDoubleTap(e: any): void {
    this.setNightMode(this.isNightMode ? false: true);
  }

  public onSwipe(e: any): void {
    switch (e.direction) {
      case 2:
        this.pageUp();
        break;

      case 4:
        this.pageDown();
        break;

      default:
        break;
    }
  }

  setTheme(theme: string) {
    this.appSettingsService.setThemeName(theme);
  }

  setNightMode(nightMode: boolean) {
    this.isNightMode = nightMode;
    if (this.isNightMode) {
      this.appSettingsService.setThemeName("nightMode");
    } else {
      this.appSettingsService.setThemeName(this.themeName);
    }
  }

  unlockPage() {
    if (this.unlockStatus) {
      // console.log("Locking");
      this.unlockStatus = false;
    } else {
      // console.log("Unlocking");
      this.unlockStatus = true;
    }
    this.appSettingsService.setUnlockStatus(this.unlockStatus);
  }

  newPage() {
    this.LayoutSplitsService.newRootSplit();
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
