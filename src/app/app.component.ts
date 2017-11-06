import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { OverlayContainer } from '@angular/material';
import { LayoutSplitsService } from './layout-splits.service';


import { AppSettingsService } from './app-settings.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { DataSetService } from './data-set.service';
import { DerivedService } from './derived.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css', './app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  pageName: string = '';
  rootPageIndexSub: Subscription;

  unlockStatus: boolean = false; 
  unlockStatusSub: Subscription;

  themeName: string;
  themeClass: string = 'default-light fullheight';
  themeNameSub: Subscription;

  constructor(  
    private AppSettingsService: AppSettingsService,
    private SignalKConnectionService: SignalKConnectionService,
    private DataSetService: DataSetService,
    private DerivedService: DerivedService,
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
    this.DerivedService.startAllDerivations();
  }

  ngOnDestroy() {
    this.rootPageIndexSub.unsubscribe();
    this.unlockStatusSub.unsubscribe();
    this.themeNameSub.unsubscribe();
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

  deletePage() {
    
  }

  pageDown() {
        this.LayoutSplitsService.previousRoot();

  }

  pageUp() {
    this.LayoutSplitsService.nextRoot();
   
  }

  fullScreenStart() {

  }

  stopFullScreen() {
    
  }

}
