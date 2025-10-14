import { Component, OnInit, OnDestroy, inject, AfterViewInit, effect, Signal, model, DestroyRef, signal, viewChild, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
import { NotificationOverlayService } from './core/services/notification-overlay.service';
import { OverlayModule } from '@angular/cdk/overlay';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GestureDirective } from './core/directives/gesture.directive';
import { MenuActionsComponent } from './core/components/menu-actions/menu-actions.component';
import { DashboardService } from './core/services/dashboard.service';
import { uiEventService } from './core/services/uiEvent.service';
import { DialogService } from './core/services/dialog.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NotificationsService } from './core/services/notifications.service';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { DatasetService } from './core/services/data-set.service';
import { ConfigurationUpgradeService } from './core/services/configuration-upgrade.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MenuNotificationsComponent, MenuActionsComponent, MatButtonModule, MatMenuModule, MatIconModule, RouterModule, MatSidenavModule, GestureDirective, OverlayModule, MatProgressSpinnerModule]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly _snackBar = inject(MatSnackBar);
  private readonly _deltaService = inject(SignalKDeltaService); // force init
  private readonly _connectionStateMachine = inject(ConnectionStateMachine);
  private readonly _app = inject(AppService);
  private readonly _dashboard = inject(DashboardService);
  private readonly _notifications = inject(NotificationsService);
  private readonly _uiEvent = inject(uiEventService);
  private readonly _dialog = inject(DialogService);
  public readonly appSettingsService = inject(AppSettingsService);
  public readonly authenticationService = inject(AuthenticationService);
  private readonly _dataSet = inject(DatasetService); // force init
  private readonly _responsive = inject(BreakpointObserver);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _notificationOverlay = inject(NotificationOverlayService);
  private readonly _router = inject(Router);
  protected readonly upgrade = inject(ConfigurationUpgradeService); // expose for template overlay

  private upgradeMessagesRef = viewChild<ElementRef<HTMLUListElement> | undefined>('upgradeMessages');

  private notificationHowl?: Howl;
  private _upgradeShown = false;

  protected actionsSidenavOpened = model<boolean>(false);
  protected notificationsSidenavOpened = model<boolean>(false);
  protected readonly notificationsInfo = toSignal(this._notifications.observerNotificationsInfo());
  protected dashboardVisible = signal<boolean>(false);
  protected isPhonePortrait: Signal<BreakpointState>;
  private scheduledOpen: number | null = null;
  private readonly OPEN_DELAY_MS = 300; // should match/ exceed sidenav close animation time

  // Stable handler refs (prevent leak from rebinding)
  private readonly _swipeLeftHandler = () => this.onSwipeLeft();
  private readonly _swipeRightHandler = () => this.onSwipeRight();
  private readonly _hotkeyHandler = (key: string) => this.handleKeyDown(key);

  constructor() {
    effect(() => {
      if (this.appSettingsService.configUpgrade()) {
        const liveVersion = this.appSettingsService.getConfigVersion();

        if (liveVersion === 11) {
          this.upgrade.runUpgrade(liveVersion);
        }

        if (!liveVersion) {
          if (!this._upgradeShown) {
            this._upgradeShown = true;
            this._dialog.openFrameDialog({
              title: 'Upgrade Instructions',
              component: 'upgrade-config',
            }, true)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe();
          }
        }
      }
    });

    effect(() => {
      const msg = this.upgrade.messages();
      // Only run if the overlay is visible and there are messages
      if (this.upgrade.upgrading() && msg.length && this.upgradeMessagesRef()) {
        const ul = this.upgradeMessagesRef().nativeElement;
        // Scroll to the bottom
        ul.scrollTop = ul.scrollHeight;
      }
    });

    // Sequencing: only open overlay when notifications sidenav is closed.
    // Also ensure overlay is closed if the sidenav opens.
    // Use effects to react to relevant signals in an injection context.
    // Effect: open/close overlay based on dashboard static state and notificationsInfo,
    // but only when the notifications sidenav is closed.
    // We'll delay opening the overlay until after the sidenav close animation completes
    // to avoid visual overlap during the closing transition. If the sidenav re-opens
    // before the delay expires, cancel the scheduled open.

    // initialize dashboardVisible from current URL
    try {
      this.dashboardVisible.set(this.isUrlDashboard(this._router.url));
    } catch { /* ignore */ }

    // update dashboardVisible on navigation (auto-unsubscribes via DestroyRef)
    this._router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this._destroyRef))
      .subscribe((e: NavigationEnd) => {
        try {
          this.dashboardVisible.set(this.isUrlDashboard((e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url));
        } catch { /* ignore */ }
      });

    effect(() => {
      const shouldShowBadge = this.dashboardVisible() && this._dashboard.isDashboardStatic() && this.notificationsInfo().alarmCount > 0;
      const sidenavOpen = this.notificationsSidenavOpened();

      // If sidenav is open, immediately close overlay and cancel any scheduled open
      if (sidenavOpen) {
        if (this.scheduledOpen) {
          clearTimeout(this.scheduledOpen as unknown as number);
          this.scheduledOpen = null;
        }
        try { this._notificationOverlay.close(); } catch { /* ignore */ }
        return;
      }

      // Sidenav is closed: if we need to show the badge, schedule an open after delay
      if (shouldShowBadge) {
        if (this.scheduledOpen) {
          // already scheduled
          return;
        }
        this.scheduledOpen = window.setTimeout(() => {
          this.scheduledOpen = null;
          try { this._notificationOverlay.open(); } catch { /* ignore */ }
        }, this.OPEN_DELAY_MS);
      } else {
        // Nothing to show: ensure no scheduled open is pending and overlay closed
        if (this.scheduledOpen) {
          clearTimeout(this.scheduledOpen as unknown as number);
          this.scheduledOpen = null;
        }
        try { this._notificationOverlay.close(); } catch { /* ignore */ }
      }
    });

    // Ensure immediate closure if user programmatically opens the sidenav elsewhere.
    effect(() => {
      const sidenavOpen = this.notificationsSidenavOpened();
      if (sidenavOpen) {
        try {
          this._notificationOverlay.close();
        } catch {
          // ignore
        }
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

  private isUrlDashboard(url: string | null | undefined): boolean {
    if (!url) return false;
    // Normalize trailing slash
    const path = url.split('?')[0].replace(/\/+$/, '');
    // Matches /dashboard and /dashboard/<id>
    return path === '/dashboard' || /^\/dashboard(\/\d+)?$/.test(path) || path === '/';
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

  private handleKeyDown(key: string): void {
    switch (key) {
      case 'arrowright':
  this.onSwipeRight();
        break;
      case 'arrowleft':
  this.onSwipeLeft();
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

  protected onSwipeRight(): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
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

  protected onSwipeLeft(): void {
    if (this._dashboard.isDashboardStatic() && !this._uiEvent.isDragging()) {
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
    // clear any pending scheduled open to avoid orphaned timer running after destroy
    if (this.scheduledOpen) {
      clearTimeout(this.scheduledOpen as unknown as number);
      this.scheduledOpen = null;
    }
  }
}
