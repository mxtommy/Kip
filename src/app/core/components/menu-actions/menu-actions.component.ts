import { Component, input } from '@angular/core';
import { DialogService } from '../../services/dialog.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import screenfull from 'screenfull';
import { Router, RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { DashboardService } from '../../services/dashboard.service';
import { MatSidenav } from '@angular/material/sidenav';
declare var NoSleep: any; //3rd party library

@Component({
  selector: 'menu-actions',
  standalone: true,
  imports: [ MatIconModule, MatMenuModule, MatButtonModule, RouterModule, MatListModule, MatDividerModule ],
  templateUrl: './menu-actions.component.html',
  styleUrl: './menu-actions.component.scss'
})

export class MenuActionsComponent {
  protected actionsSidenav = input.required<MatSidenav>();
  protected fullscreenStatus = false;
  protected noSleep = new NoSleep();
  protected isNightMode: boolean = false;

  constructor(
    private _dialog: DialogService,
    private _router: Router,
    protected dashboard: DashboardService
  ) { }

  protected setNightMode(nightMode: boolean): void {
    //TODO: See if yo still need this or fix new brightness
    // this.isNightMode = nightMode;
    // if (this.isNightMode) {
    //   this.appSettingsService.setThemeName("nightMode");
    // } else {
    //   this.appSettingsService.setThemeName(this.themeName);
    // }
  }

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

      case 'toggleFullScreen':
        this.toggleFullScreen();
        break;

      case 'dayNightMode':
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
