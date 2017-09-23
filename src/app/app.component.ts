import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';
import { OverlayContainer } from '@angular/material';

import { TreeNode, TreeManagerService } from './tree-manager.service';
import { AppSettingsService } from './app-settings.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { DataSetService } from './data-set.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css', './app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  rootPage: TreeNode;
  pageName: string = '';
  rootPageIndexSub: Subscription;

  unlockStatus: boolean = false; 
  unlockStatusSub: Subscription;


  themeClass: string = 'default-light fullheight';
  themeNameSub: Subscription;

  constructor(  
    private treeManager: TreeManagerService,
    private AppSettingsService: AppSettingsService,
    private route: ActivatedRoute,
    private SignalKConnectionService: SignalKConnectionService,
    private router: Router,
    private DataSetService: DataSetService,
    private overlayContainer: OverlayContainer) { }


  ngOnInit() {
    // when root uuid changes, update page.
    this.rootPageIndexSub = this.treeManager.getRootIndex().subscribe(
      index => {
        let rootNodes = this.treeManager.getRootNodes();
        this.rootPage = this.treeManager.getNode(rootNodes[index]);
        this.pageName = this.rootPage.name;
      }
    );

    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      status => { this.unlockStatus = status; }
    );

    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      newTheme => {
        this.themeClass = newTheme + ' fullheight'; // need fullheight there to set 100%height
        this.overlayContainer.getContainerElement().classList.add(newTheme);
      }
    )

    this.DataSetService.startAllDataSets();
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
      let newuuid = this.treeManager.newNode('ROOT');
      let rootNodes = this.treeManager.getRootNodes();

      this.router.navigate(['/page', rootNodes.findIndex(uuid => uuid == newuuid)]);
  }

  deletePage() {
    
  }

  pageDown() {
    let rootNodes = this.treeManager.getRootNodes();
    let currentIndex = rootNodes.findIndex(uuid => uuid == this.rootPage.uuid);
    let rootNum = Object.keys(rootNodes).length;

    if (currentIndex == 0) {
      this.router.navigate(['/page', rootNum -1]); // going down from 0, go to max
    } else {
      this.router.navigate(['/page', currentIndex - 1]);
    }
    
  }

  pageUp() {
    let rootNodes = this.treeManager.getRootNodes();
    let currentIndex = rootNodes.findIndex(uuid => uuid == this.rootPage.uuid);
    let rootNum = Object.keys(rootNodes).length;

    if (currentIndex >= (rootNum-1)) {
      this.router.navigate(['/page', 0]); // going down from 0, go to max
    } else {
      this.router.navigate(['/page', currentIndex + 1]);
    }
  }

}
