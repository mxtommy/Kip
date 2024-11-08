import { Component, inject, input } from '@angular/core';
import { DialogService } from '../../services/dialog.service';
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
  protected fullscreenStatus = false;
  protected noSleep = new NoSleep();
  protected isNightMode: boolean = false;
  private _dialog = inject(DialogService);
  private _router = inject(Router);
  protected dashboard = inject(DashboardService);
  protected app = inject(AppService);

  protected readonly menuItems: MenuActionItem[]  = [
    { svgIcon: 'dashboard', iconSize: 48, label: 'Dashboards', action: 'dashboards' },
    { svgIcon: 'dataset', iconSize: 48, label: 'Datasets', action: 'datasets' },
    { svgIcon: 'troubleshoot', iconSize:  48, label: 'Data Browser', action: 'databrowser' },
    { svgIcon: 'tune', iconSize:  48, label: 'Configurations', action: 'configurations' },
    { svgIcon: 'help-center', iconSize:  48, label: 'Help Center', action: 'help' },
  ];

  protected OpenSettingsDialog(): void {
    this._dialog.openFrameDialog({
      title: 'Settings',
      component: 'settings',
    }, true).subscribe();
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

      case 'reset':
      this._router.navigate(['/reset']);
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
        this.app.toggleDayNightMode('night');
        break;

      case 'dayMode':
        this.app.toggleDayNightMode('day');
        break;

      default:
        break;
    }
  }

  private toggleFullScreen(): void {
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
