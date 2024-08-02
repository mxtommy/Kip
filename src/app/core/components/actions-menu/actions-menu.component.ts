import { Component } from '@angular/core';
import { DialogService } from '../../services/dialog.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LayoutSplitsService } from '../../services/layout-splits.service';
import { Observable } from 'rxjs';
import screenfull from 'screenfull';
import { AsyncPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
declare var NoSleep: any; //3rd party library

@Component({
  selector: 'actions-menu',
  standalone: true,
  imports: [ MatIconModule, MatMenuModule, MatButtonModule, RouterModule, MatListModule, MatDividerModule, AsyncPipe ],
  templateUrl: './actions-menu.component.html',
  styleUrl: './actions-menu.component.scss'
})

export class ActionsMenuComponent {
  protected fullscreenStatus = false;
  protected noSleep = new NoSleep();
  protected isNightMode: boolean = false;
  protected dashboardEdit$: Observable<boolean> = this.layout.getEditLayoutObservable();

  constructor(private dialog: DialogService, private layout: LayoutSplitsService) {
  }

  protected setNightMode(nightMode: boolean): void {
    //TODO: See if yo still need this or fix new brightness
    // this.isNightMode = nightMode;
    // if (this.isNightMode) {
    //   this.appSettingsService.setThemeName("nightMode");
    // } else {
    //   this.appSettingsService.setThemeName(this.themeName);
    // }
  }

  protected toggleFullScreen(): void {
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

  protected unlockPage(unlock: boolean): void {
    //TODO: remove this
    this.layout.setEditLayoutStatus(unlock);
  }

  protected OpenSettingsDialog(): void {
    this.dialog.openFrameDialog({
      title: 'Settings',
      component: 'settings',
    }, true).subscribe();
  }

  protected newPage(): void {
    this.layout.newRootSplit();
  }
}
