import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LayoutSplitsService } from './layout-splits.service';

import * as screenfull from 'screenfull';

import { AppSettingsService } from './app-settings.service';
import { DataSetService } from './data-set.service';
import { NotificationsService } from './notifications.service';


declare var NoSleep: any; //3rd party

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  noSleep = new NoSleep();

  pageName: string = '';

  unlockStatus: boolean = false;
  unlockStatusSub: Subscription;

  fullscreenStatus = false;


  themeName: string;
  themeClass: string = 'default-light fullheight';
  themeNameSub: Subscription;

  notificationSub: Subscription;


  constructor(
    private AppSettingsService: AppSettingsService,
    private DataSetService: DataSetService,
    private NotificationsService: NotificationsService,
    private _snackBar: MatSnackBar,
    private overlayContainer: OverlayContainer,
    private LayoutSplitsService: LayoutSplitsService) { }


  ngOnInit() {
    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      status => { this.unlockStatus = status; }
    );

    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      newTheme => {
        this.themeClass = newTheme + ' fullheight'; // need fullheight there to set 100%height
        if (this.themeName) {
          this.overlayContainer.getContainerElement().classList.remove(this.themeName);
        }
        this.overlayContainer.getContainerElement().classList.add(newTheme);
        this.themeName = newTheme;
      }
    )
    this.DataSetService.startAllDataSets();
    
    // Snackbar Notification Code
    this.notificationSub = this.NotificationsService.getNotificationObservable().subscribe(
      appNotififaction => {
        this._snackBar.open(appNotififaction.message, 'dismiss', {
          duration: appNotififaction.duration,
          verticalPosition: 'top'
        });
      }
    )


  }

  ngOnDestroy() {
    this.unlockStatusSub.unsubscribe();
    this.themeNameSub.unsubscribe();
    this.notificationSub.unsubscribe();

  }

  setTheme(theme: string) {
    this.AppSettingsService.setThemName(theme);
  }


  unlockPage() {
    if (this.unlockStatus) {
      console.log("Locking");
      this.unlockStatus = false;
    } else {
      console.log("Unlocking");
      this.unlockStatus = true;
    }
    this.AppSettingsService.setUnlockStatus(this.unlockStatus);
  }


  newPage() {
    this.LayoutSplitsService.newRootSplit();
      //this.router.navigate(['/page', rootNodes.findIndex(uuid => uuid == newuuid)]);
  }

  pageDown() {
        this.LayoutSplitsService.previousRoot();

  }

  pageUp() {
    this.LayoutSplitsService.nextRoot();

  }

  toggleFullScreen() {
    if (!this.fullscreenStatus) {
      screenfull.request();
      this.noSleep.enable();
    } else {
      if (screenfull.isFullscreen) {
        screenfull.exit();
      }
      this.noSleep.disable();
    }

    this.fullscreenStatus = !this.fullscreenStatus;
  }

}
