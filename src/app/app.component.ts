import { Component, OnInit, OnDestroy, viewChild, inject, EventEmitter, AfterViewInit, effect, Signal, model } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthenticationService } from './core/services/authentication.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { SignalKDeltaService } from './core/services/signalk-delta.service';
import { ConnectionStateMachine, IConnectionStatus } from './core/services/connection-state-machine.service';
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
import { uiEventService } from './core/services/uiEvent.service';
import { DialogService } from './core/services/dialog.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [ MenuNotificationsComponent, MenuActionsComponent, MatButtonModule, MatMenuModule, MatIconModule, RouterModule, MatSidenavModule ]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private _snackBar = inject(MatSnackBar);
  private _deltaService = inject(SignalKDeltaService);
  private _connectionStateMachine = inject(ConnectionStateMachine);
  private _app = inject(AppService);
  private _dashboard = inject(DashboardService);
  private _uiEvent = inject(uiEventService);
  private _dialog = inject(DialogService);
  public appSettingsService = inject(AppSettingsService);
  public authenticationService = inject(AuthenticationService);
  private _responsive = inject(BreakpointObserver);
  public openSidenavEvent: EventEmitter<void> = new EventEmitter<void>();

  protected actionsSidenav = viewChild<MatSidenav>('actionsSidenav');
  protected actionsSidenavOpen = model<boolean>(false);
  protected notificationsSidenavOpened = model<boolean>(false);
  protected isPhonePortrait: Signal<BreakpointState>;
  protected notificationsVisibility = 'hidden';


  protected themeName: string;
  private themeNameSub: Subscription;
  private appNotificationSub: Subscription;
  private connectionStatusSub: Subscription;

  constructor() {
    effect(() => {
      if (this.appSettingsService.configUpgrade()) {
        this._dialog.openFrameDialog({
          title: 'Configuration Upgrade',
          component: 'upgrade-config',
        }, true).subscribe(data => {
          if (!data) {return} //clicked cancel

        });
      }
    });

    this.isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));
  }

  ngOnInit() {
    // Connection Status Notification sub
    this.connectionStatusSub = this._connectionStateMachine.status$.subscribe((status: IConnectionStatus) => {
      this.displayConnectionsStatusNotification(status);
      }
    );

    // Snackbar Notifications sub
    this.appNotificationSub = this._app.getSnackbarAppNotifications().subscribe(appNotification => {
        this._snackBar.open(appNotification.message, 'dismiss', {
          duration: appNotification.duration,
          verticalPosition: 'top'
        });

        if (!this.appSettingsService.getNotificationConfig().sound.disableSound && !appNotification.silent) {
          let sound = new Howl({
            src: ['assets/notification.mp3'],
            autoplay: true,
            preload: true,
            loop: false,
            volume: 0.3,
            onend: function() {
              // console.log('Finished!');
              // sound.unload();
              sound = undefined;
            },
            onloaderror: function() {
              console.log("snackbar: player onload error");
              sound.unload();
              sound = undefined;
            },
            onplayerror: function() {
              console.log("snackbar: player locked");
              this.howlPlayer.once('unlock', function() {
                this.howlPlayer.play();
                this.howlPlayer.unload();
                this.howlPlayer = undefined;
              });
              sound.unload();
              sound = undefined;
            }
          });
          sound.play();
          Howler.autoUnlock = true;
          Howler.autoSuspend = false;
        }
      }
    );

    // Add event listeners for swipe gestures
    this._uiEvent.addGestureListeners(
      this.onSwipeLeft.bind(this),
      this.onSwipeRight.bind(this)
    );
  }

  ngAfterViewInit(): void {
    this._uiEvent.addHotkeyListener(
      (key, event) => this.handleKeyDown(key, event),
      { ctrlKey: true, keys: ['arrowright', 'arrowleft'] } // Filter for arrow keys with Ctrl
    );
  }

  private handleKeyDown(key: string, event: KeyboardEvent): void {
    if (key === 'arrowright') {
      this.onSwipeRight(event);
    } else if (key === 'arrowleft') {
      this.onSwipeLeft(event);
    }
  }

  private displayConnectionsStatusNotification(connectionStatus: IConnectionStatus) {
    const message = connectionStatus.message;

    // Use legacy operation codes for compatibility
    switch (connectionStatus.operation) {
      case 0: // not connected
        this._app.sendSnackbarNotification(message, 5000, true);
        break;

      case 1: // connecting
        this._app.sendSnackbarNotification(message, 5000, true); // Increased from 2000 to see it longer
       break;

      case 2: // connected
        this._app.sendSnackbarNotification(message, 2000, false);
        break;

      case 3: // connection error/retrying
        this._app.sendSnackbarNotification(message, 5000, false); // Changed from 0 (indefinite) to 5000 to avoid blocking
        break;

      case 4: // resetting
        this._app.sendSnackbarNotification(message, 3000, true);
        break;

      case 5: // permanent failure
        this._app.sendSnackbarNotification(message, 0, false);
        break;

      default:
        console.error(`[AppComponent] Unknown operation code: ${connectionStatus.operation} for state: ${connectionStatus.state}`);
        this._app.sendSnackbarNotification(`Unknown connection status: ${connectionStatus.state}`, 0, false);
        break;
    }
  }

  protected onSwipeRight(e: Event): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
      e.preventDefault();
      if (this.isPhonePortrait().matches) {
        this.actionsSidenavOpen.set(false);
        this.notificationsSidenavOpened.set(true);
      } else {
        this.notificationsSidenavOpened.set(true);
      }
    }
  }

  protected onSwipeLeft(e: Event): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
      e.preventDefault();
      if (this.isPhonePortrait().matches) {
        this.notificationsSidenavOpened.set(false);
        this.actionsSidenavOpen.set(true);
      } else {
        this.actionsSidenavOpen.set(true);
      }
    }
  }

  ngOnDestroy() {
    this.themeNameSub.unsubscribe();
    this.appNotificationSub.unsubscribe();
    this.connectionStatusSub.unsubscribe();
    this._uiEvent.removeGestureListeners(
      this.onSwipeLeft.bind(this),
      this.onSwipeRight.bind(this)
    );
    this._uiEvent.removeHotkeyListener(this.handleKeyDown.bind(this));
  }
}
