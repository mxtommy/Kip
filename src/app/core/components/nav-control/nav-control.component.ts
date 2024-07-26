import { Component } from '@angular/core';
import { DialogService } from './../../services/dialog.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LayoutSplitsService } from '../../services/layout-splits.service';
import { Observable } from 'rxjs';
import screenfull from 'screenfull';
import { AsyncPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
declare var NoSleep: any; //3rd party library

@Component({
  selector: 'app-nav-control',
  standalone: true,
  imports: [ MatIconModule, MatMenuModule, MatButtonModule, RouterModule, MatListModule, AsyncPipe ],
  templateUrl: './nav-control.component.html',
  styleUrl: './nav-control.component.scss'
})

export class NavControlComponent {
  protected fullscreenStatus = false;
  protected noSleep = new NoSleep();
  protected isNightMode: boolean = false;
  protected dashboardEdit$: Observable<boolean> = this.layout.getEditLayoutObservable();

  constructor(private dialog: DialogService, private layout: LayoutSplitsService) {
  }

  protected setNightMode(nightMode: boolean): void {
    //TODO: See if yo still need this
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
