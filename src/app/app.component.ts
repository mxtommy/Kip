import { Component, OnInit, OnDestroy, signal, viewChild, inject, EventEmitter, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthenticationService } from './core/services/authentication.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { SignalKDeltaService, IStreamStatus } from './core/services/signalk-delta.service';
import { AppService } from './core/services/app-service';
import { Howl } from 'howler';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MenuNotificationsComponent } from './core/components/menu-notifications/menu-notifications.component';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MenuActionsComponent } from './core/components/menu-actions/menu-actions.component';
import { DashboardService } from './core/services/dashboard.service';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [ MenuNotificationsComponent, MenuActionsComponent, MatButtonModule, MatMenuModule, MatIconModule, RouterModule, MatSidenavModule ]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private _snackBar = inject(MatSnackBar);
  private _deltaService = inject(SignalKDeltaService);
  private _app = inject(AppService);
  private _dashboard = inject(DashboardService);
  public appSettingsService = inject(AppSettingsService);
  public authenticationService = inject(AuthenticationService);
  public openSidenavEvent: EventEmitter<void> = new EventEmitter<void>();

  protected actionsSidenav = viewChild<MatSidenav>('actionsSidenav');
  protected actionsSidenavOpen = false;
  protected notificationsSidenavOpened = signal<boolean>(false);
  protected notificationsVisibility: string = 'hidden';
  private initialTouchX: number | null = null;
  private initialTouchY: number | null = null;

  protected themeName: string;
  //TODO: Still need this?
  // activeThemeClass: string = 'modern-dark fullheight';
  activeTheme: string;
  private themeNameSub: Subscription;
  private appNotificationSub: Subscription;
  private connectionStatusSub: Subscription;

  ngOnInit() {
    // Connection Status Notification sub
    this.connectionStatusSub = this._deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus) => {
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
    this.appNotificationSub = this._app.getSnackbarAppNotifications().subscribe(appNotification => {
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

    document.addEventListener('openLeftSidenav', this.onSwipeLeft.bind(this));
    document.addEventListener('openRightSidenav', this.onSwipeRight.bind(this));
    document.addEventListener('touchstart', this.preventBrowserHistorySwipeGestures.bind(this), { passive: false });
    document.addEventListener('touchmove', this.preventBrowserHistorySwipeGestures.bind(this), { passive: false });
    document.addEventListener('touchend', this.preventBrowserHistorySwipeGestures.bind(this));
    document.addEventListener('touchcancel', this.preventBrowserHistorySwipeGestures.bind(this));
  }

  ngAfterViewInit(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Avoid executing shortcuts when an input field is focused
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (event.ctrlKey && event.ctrlKey) {
      switch (event.key) {
        case 'ArrowRight':
          this.onSwipeRight(event);
          break;
        case 'ArrowLeft':
          this.onSwipeLeft(event);
          break;
        default:
          break;
      }
    }
  }

  private displayConnectionsStatusNotification(streamStatus: IStreamStatus) {
    switch (streamStatus.operation) {
      case 0: // not connected
        this._app.sendSnackbarNotification("Not connected to server.", 5000, true);
        break;

      case 1: // connecting
        this._app.sendSnackbarNotification("Connecting to server.", 2000, true);
       break;

      case 2: // connected
        this._app.sendSnackbarNotification("Connection successful.", 2000, false);
        break;

      case 3: // connection error
        this._app.sendSnackbarNotification("Error connecting to server.", 0, false);
        break;

      default:
        this._app.sendSnackbarNotification("Unknown stream connection status.", 0, false);
        break;
    }
  }

  protected preventBrowserHistorySwipeGestures(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (e.type === 'touchstart') {
        this.initialTouchX = touch.clientX;
        this.initialTouchY = touch.clientY;
        // Block swipe gestures from the left and right edges of the screen for mobile browsers
        if (this.initialTouchX < 20 || this.initialTouchX > window.innerWidth - 20) {
          e.preventDefault();
        }
      }
      else if (e.type === 'touchmove' && this.initialTouchX !== null && this.initialTouchY !== null) {
        const deltaX = Math.abs(touch.clientX - this.initialTouchX);
        const deltaY = Math.abs(touch.clientY - this.initialTouchY);

        if (deltaX > deltaY && (this.initialTouchX < 20 || this.initialTouchX > window.innerWidth - 20)) {
          e.preventDefault();
        }
      }
      else if (e.type === 'touchend' || e.type === 'touchcancel') {
        this.initialTouchX = null;
        this.initialTouchY = null;
      }
    }
  }

  protected onSwipeRight(e: Event): void {
    if (this._dashboard.isDashboardStatic()) {
      e.preventDefault();
      this.notificationsSidenavOpened.set(true);
    }
  }

  protected onSwipeLeft(e: Event): void {
    if (this._dashboard.isDashboardStatic()) {
      e.preventDefault();
      this.actionsSidenavOpen = true;
    }
  }

  ngOnDestroy() {
    this.themeNameSub.unsubscribe();
    this.appNotificationSub.unsubscribe();
    this.connectionStatusSub.unsubscribe();
    document.removeEventListener('openLeftSidenav', this.onSwipeLeft);
    document.removeEventListener('openRightSidenav', this.onSwipeRight);
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('touchstart', this.preventBrowserHistorySwipeGestures.bind(this));
    document.removeEventListener('touchmove', this.preventBrowserHistorySwipeGestures.bind(this));
    document.removeEventListener('touchend', this.preventBrowserHistorySwipeGestures.bind(this));
    document.removeEventListener('touchcancel', this.preventBrowserHistorySwipeGestures.bind(this));
  }
}
