import { Component, OnInit, OnDestroy, signal, viewChild, inject, EventEmitter, AfterViewInit, effect, Signal, model } from '@angular/core';
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
import { uiEventService } from './core/services/uiEvent.service';
import { DialogService } from './core/services/dialog.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';


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
  protected notificationsVisibility: string = 'hidden';


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
    this.connectionStatusSub = this._deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus) => {
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
