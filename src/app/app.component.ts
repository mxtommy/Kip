import { Component, OnInit, OnDestroy, inject, AfterViewInit, effect, Signal, model, DestroyRef } from '@angular/core';
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
import { MatSidenavModule } from '@angular/material/sidenav';
import { MenuActionsComponent } from './core/components/menu-actions/menu-actions.component';
import { DashboardService } from './core/services/dashboard.service';
import { uiEventService } from './core/services/uiEvent.service';
import { DialogService } from './core/services/dialog.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { DatasetService } from './core/services/data-set.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MenuNotificationsComponent, MenuActionsComponent, MatButtonModule, MatMenuModule, MatIconModule, RouterModule, MatSidenavModule]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly _snackBar = inject(MatSnackBar);
  private readonly _deltaService = inject(SignalKDeltaService); // force init
  private readonly _connectionStateMachine = inject(ConnectionStateMachine);
  private readonly _app = inject(AppService);
  private readonly _dashboard = inject(DashboardService);
  private readonly _uiEvent = inject(uiEventService);
  private readonly _dialog = inject(DialogService);
  public readonly appSettingsService = inject(AppSettingsService);
  public readonly authenticationService = inject(AuthenticationService);
  private readonly _dataSet = inject(DatasetService); // force init
  private readonly _responsive = inject(BreakpointObserver);
  private readonly _destroyRef = inject(DestroyRef);

  private notificationHowl?: Howl;
  private _upgradeShown = false;

  protected actionsSidenavOpened = model<boolean>(false);
  protected notificationsSidenavOpened = model<boolean>(false);
  protected isPhonePortrait: Signal<BreakpointState>;

  // Stable handler refs (prevent leak from rebinding)
  private readonly _swipeLeftHandler = (e: Event) => this.onSwipeLeft(e);
  private readonly _swipeRightHandler = (e: Event) => this.onSwipeRight(e);
  private readonly _hotkeyHandler = (key: string, event: KeyboardEvent) => this.handleKeyDown(key, event);

  constructor() {
    effect(() => {
      if (!this._upgradeShown && this.appSettingsService.configUpgrade()) {
        this._upgradeShown = true;
        this._dialog.openFrameDialog({
          title: 'Upgrade Instructions',
          component: 'upgrade-config',
        }, true)
          .pipe(takeUntilDestroyed(this._destroyRef))
          .subscribe();
      }
    });

    this.isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));

    this._connectionStateMachine.status$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((status: IConnectionStatus) => this.displayConnectionsStatusNotification(status));

    this._app.getSnackbarAppNotifications()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(appNotification => {
        this._snackBar.open(appNotification.message, appNotification.action, {
          duration: appNotification.duration,
          verticalPosition: 'top'
        });

        if (!this.appSettingsService.getNotificationConfig().sound.disableSound && !appNotification.silent) {
          if (!this.notificationHowl) {
            this.notificationHowl = new Howl({
              src: ['assets/notification.mp3'],
              preload: true,
              volume: 0.3
            });
          }
          // restart sound for rapid successive notifications
          this.notificationHowl.stop();
          this.notificationHowl.play();
        }
      });
  }

  ngOnInit() {
    this._uiEvent.addGestureListeners(
      this._swipeLeftHandler,
      this._swipeRightHandler
    );
  }

  ngAfterViewInit(): void {
    this._uiEvent.addHotkeyListener(
      this._hotkeyHandler,
      { ctrlKey: true, keys: ['arrowright', 'arrowleft'] }
    );
  }

  private handleKeyDown(key: string, event: KeyboardEvent): void {
    switch (key) {
      case 'arrowright':
        this.onSwipeRight(event);
        break;
      case 'arrowleft':
        this.onSwipeLeft(event);
        break;
      case 'escape':
        this.backdropClicked();
        break;
    }
  }

  protected escapeKeyPressed(key: string): void {
    key = key.toLowerCase();
    if (key === 'escape') this.backdropClicked();
  }

  private displayConnectionsStatusNotification(connectionStatus: IConnectionStatus) {
    const message = connectionStatus.message;
    switch (connectionStatus.operation) {
      case 0:
        this._app.sendSnackbarNotification(message, 5000, true);
        break;
      case 1:
      case 2:
        break;
      case 3:
        this._app.sendSnackbarNotification(message, 3000, false, "");
        break;
      case 4:
        this._app.sendSnackbarNotification(message, 3000, true, "");
        break;
      case 5:
        this._app.sendSnackbarNotification(message, 0, false);
        break;
      default:
        console.error('[AppComponent] Unknown operation code:', connectionStatus.operation);
        this._app.sendSnackbarNotification(`Unknown connection status: ${connectionStatus.state}`, 0, false);
    }
  }

  protected onSwipeRight(e: Event): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
      e.preventDefault();
      if (this.isPhonePortrait().matches) {
        this.actionsSidenavOpened.set(false);
        this.notificationsSidenavOpened.set(true);
      } else {
        this.actionsSidenavOpened.set(false);
        this.notificationsSidenavOpened.update(o => !o);
      }
    }
  }

  protected backdropClicked(): void {
    this.notificationsSidenavOpened.update(o => o ? !o : false);
    this.actionsSidenavOpened.update(o => o ? !o : false);
  }

  protected onSwipeLeft(e: Event): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
      e.preventDefault();
      if (this.isPhonePortrait().matches) {
        this.notificationsSidenavOpened.set(false);
        this.actionsSidenavOpened.set(true);
      } else {
        this.notificationsSidenavOpened.set(false);
        this.actionsSidenavOpened.update(o => !o);
      }
    }
  }

  ngOnDestroy() {
    this._uiEvent.removeGestureListeners(
      this._swipeLeftHandler,
      this._swipeRightHandler
    );
    this._uiEvent.removeHotkeyListener(this._hotkeyHandler);
    this.notificationHowl?.unload();
    this.notificationHowl = undefined;
  }
}
