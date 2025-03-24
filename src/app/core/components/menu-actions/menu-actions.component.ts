import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import screenfull from 'screenfull';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { MatSidenav } from '@angular/material/sidenav';
import { AppService } from '../../services/app-service';
import { LargeIconTile, TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
declare var NoSleep: any; //3rd party library

interface MenuActionItem extends LargeIconTile {
  action: string;
}

@Component({
  selector: 'menu-actions',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule, TileLargeIconComponent ],
  templateUrl: './menu-actions.component.html',
  styleUrl: './menu-actions.component.scss'
})

export class MenuActionsComponent {
  protected actionsSidenav = input.required<MatSidenav>();
  protected fullscreenStatus = signal<boolean>(false);
  protected fullscreenSupported = signal<boolean>(true);
  protected noSleepStatus = signal<boolean>(false);
  protected noSleepSupported = signal<boolean>(true);
  private noSleep = new NoSleep();
  private _router = inject(Router);
  private dashboard = inject(DashboardService);
  protected app = inject(AppService);
  protected readonly menuItems: MenuActionItem[]  = [
    { svgIcon: 'dashboard', iconSize: 48, label: 'Dashboards', action: 'dashboards' },
    { svgIcon: 'troubleshoot', iconSize:  48, label: 'Data Browser', action: 'databrowser' },
    { svgIcon: 'dataset', iconSize: 48, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'configuration', iconSize:  48, label: 'Configurations', action: 'configurations' },
    { svgIcon: 'settings', iconSize:  48, label: 'Settings', action: 'settings' },
    { svgIcon: 'help-center', iconSize:  48, label: 'Help Center', action: 'help' },
  ];

  constructor() {
    if (screenfull.isEnabled) {
      screenfull.on('change', () => {
        this.fullscreenStatus.set(screenfull.isFullscreen);
        if (!screenfull.isFullscreen) {
          this.noSleep.disable();
        }
      });
    } else {
      this.fullscreenSupported.set(false);
      console.warn('[Actions Menu] Fullscreen mode is not supported by this device/browser.');
    }

    this.checkNoSleepSupport();
    if (this.checkPwaMode() && this.noSleepSupported() && !this.noSleepStatus()) {
      this.toggleNoSleep();
    }
  }

  private checkNoSleepSupport(): void {
    try {
      this.noSleep = new NoSleep();
      if (typeof this.noSleep.enable !== 'function' || typeof this.noSleep.disable !== 'function') {
        throw new Error('[Actions Menu] NoSleep methods not available');
      }
    } catch (error) {
      this.noSleepSupported.set(false);
      console.warn('[Actions Menu] NoSleep is not supported by this device/browser.');
    }
  }

  private checkPwaMode(): boolean {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone !== undefined;
    console.log('[Actions Menu] PWA mode:', isStandalone);
    return isStandalone;
  }

  protected onItemClicked(action: string): void {
    this.actionsSidenav().close();
    switch (action) {
      case 'help':
        this._router.navigate(['/help']);
        break;

      case 'dashboards':
        this._router.navigate(['/dashboards']);
        break;

      case 'databrowser':
        this._router.navigate(['/data']);
        break;

      case 'datasets':
        this._router.navigate(['/datasets']);
        break;

      case 'configurations':
        this._router.navigate(['/configurations']);
        break;

      case 'toggleFullScreen':
        this.toggleFullScreen();
        break;

      case 'settings':
        this._router.navigate(['/settings']);
        break;

      case 'layout':
        this.dashboard.toggleStaticDashboard();
        break;

      case 'nightMode':
        this.app.toggleDayNightMode();
        break;

      case 'dayMode':
        this.app.toggleDayNightMode();
        break;

      default:
        break;
    }
  }

  protected toggleFullScreen(): void {
    if (screenfull.isEnabled) {
      if (!this.fullscreenStatus()) {
        screenfull.request();
        this.noSleep.enable();
      } else {
        if (screenfull.isFullscreen) {
          screenfull.exit();
        }
        this.noSleep.disable();
      }
      this.fullscreenStatus.set(!this.fullscreenStatus());
    } else {
      this.fullscreenSupported.set(false);
      console.warn('[Actions Menu] Fullscreen mode is not supported by this browser.');
    }
  }

  protected toggleNoSleep(): void {
    if (this.noSleepSupported()) {
      if (!this.noSleepStatus()) {
        this.noSleep.enable();
      } else {
        this.noSleep.disable();
      }
      this.noSleepStatus.set(!this.noSleepStatus());
      console.log('[Actions Menu] NoSleep:', this.noSleepStatus());
    }
  }
}
