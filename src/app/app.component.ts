import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthenticationService } from './core/services/authentication.service';
import { LayoutSplitsService } from './core/services/layout-splits.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { DatasetService } from './core/services/data-set.service';
import { NotificationsService } from './core/services/notifications.service';
import { SignalKDeltaService, IStreamStatus } from './core/services/signalk-delta.service';
import { AppService } from './core/services/app-service';
import { Howl } from 'howler';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MenuNotificationsComponent } from './core/components/menu-notifications/menu-notifications.component';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MenuActionsComponent } from './core/components/menu-actions/menu-actions.component';
import { DashboardService } from './core/services/dashboard.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [ MenuNotificationsComponent, MenuActionsComponent, MatButtonModule, MatMenuModule, MatIconModule, RouterModule, MatSidenavModule ]
})
export class AppComponent implements OnInit, OnDestroy {
  protected actionsSidenavOpen = false;

  protected notificationsSidenavOpened = signal<boolean>(false);
  protected notificationsVisibility: string = 'hidden';
  protected notificationsPresent: boolean = false;

  protected themeName: string;
  //TODO: Still need this?
  // activeThemeClass: string = 'modern-dark fullheight';
  activeTheme: string;
  private themeNameSub: Subscription;
  private appNotificationSub: Subscription;
  private connectionStatusSub: Subscription;

  constructor(
    private _snackBar: MatSnackBar,
    //TODO: Clean up
    // private LayoutSplitsService: LayoutSplitsService, // needs AppSettingsService
    public appSettingsService: AppSettingsService, // needs storage & AppInit
    private DatasetService: DatasetService, // needs AppSettingsService & SignalKDataService
    private notificationsService: NotificationsService, // needs AppSettingsService SignalKConnectionService
    public authenticationService: AuthenticationService,
    private deltaService: SignalKDeltaService,
    private appService: AppService,
    private _dashboard: DashboardService
    ) {}

  ngOnInit() {
    // Connection Status Notification sub
    this.connectionStatusSub = this.deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus) => {
      this.displayConnectionsStatusNotification(status);
      }
    );

    // Theme operations sub
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe( newTheme => {
        //TODO: See if we need to keep this to switch theme CSS class.
      //   this.activeThemeClass = newTheme + ' fullheight'; // need fullheight there to set 100%height

      //   if (!this.themeName) { // first run
      //     this.themeName = newTheme;
      //   } else  {
      //     this.overlayContainer.getContainerElement().classList.remove(this.activeTheme);
      //   }

      //   if (newTheme != 'nightMode') {
      //     this.isNightMode = false;
      //     if (newTheme !== this.themeName) {
      //       this.overlayContainer.getContainerElement().classList.add(newTheme);
      //       this.themeName = newTheme;
      //     } else {
      //       this.overlayContainer.getContainerElement().classList.add(this.themeName);
      //     }
      //   } else {
      //     this.overlayContainer.getContainerElement().classList.add(newTheme);
      //     this.isNightMode = true;
      //   }
      //   this.activeTheme = newTheme;
      }
    );

    // Snackbar Notifications sub
    this.appNotificationSub = this.appService.getSnackbarAppNotifications().subscribe(appNotification => {
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

  protected menuClosed(): void {
    if (this.notificationsPresent) {
      this.notificationsPresent = true;
    }
  }

  protected notificationsPresence($event): void {
    this.notificationsPresent = $event;
    if (!this.notificationsSidenavOpened()) {
      $event ? this.notificationsVisibility = "visible" : this.notificationsVisibility = "hidden";
    }
  }

  private displayConnectionsStatusNotification(streamStatus: IStreamStatus) {
    switch (streamStatus.operation) {
      case 0: // not connected
        this.appService.sendSnackbarNotification("Not connected to server.", 5000, true);
        break;

      case 1: // connecting
        this.appService.sendSnackbarNotification("Connecting to server.", 2000, true);
       break;

      case 2: // connected
        this.appService.sendSnackbarNotification("Connection successful.", 2000, false);
        break;

      case 3: // connection error
        this.appService.sendSnackbarNotification("Error connecting to server.", 0, false);
        break;

      default:
        this.appService.sendSnackbarNotification("Unknown stream connection status.", 0, false);
        break;
    }
  }

  protected preventSwipeDefault(e: TouchEvent): void {
    if (e.touches.length === 1 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      if(Math.abs(touch.clientX) > 30) {
        e.preventDefault();
      }
    }
  }

  protected onDoubleTap(e: any): void {
    console.log("Double Tapped");
    // this.setNightMode(this.isNightMode ? false: true);
  }

  protected onSwipe(e: any): void {
    switch (e.direction) {
      case Hammer.DIRECTION_UP:
        this.pageUp();
        break;

      case Hammer.DIRECTION_DOWN:
        this.pageDown();
        break;

      case Hammer.DIRECTION_LEFT:
        this.actionsSidenavOpen = true;
        break;

      case Hammer.DIRECTION_RIGHT:
        this.notificationsSidenavOpened.set(true);
        break;

      default:
        //TODO: Remove this console.warn
        console.warn(`Unknown Type ${e.type} direction. Direction: ${e.direction} Distance: ${e.distance} Angle: ${e.angle}`);
        break;
    }
  }

  protected pageDown() {
    this._dashboard.navigatePrevious();
  }

  protected pageUp() {
    this._dashboard.navigateNext();
  }

  ngOnDestroy() {
    this.themeNameSub.unsubscribe();
    this.appNotificationSub.unsubscribe();
    this.connectionStatusSub.unsubscribe();
  }

}
