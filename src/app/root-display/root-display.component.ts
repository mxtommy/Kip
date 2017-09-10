import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';

import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { AppSettingsService } from '../app-settings.service';


@Component({
  selector: 'app-root-display',
  templateUrl: './root-display.component.html',
  styleUrls: ['./root-display.component.css']
})
export class RootDisplayComponent implements OnInit, OnDestroy {

  rootIndexSub: Subscription;
  rootPageIndexSub: Subscription;
  unlockStatusSub: Subscription;
  unlockStatus: boolean;
  rootPage: TreeNode = { 
    uuid: null,
    name: null,
    nodeType: null,
    nodeData: null
  };

  constructor(  private treeManager: TreeManagerService,
                private AppSettingsService: AppSettingsService,
                private route: ActivatedRoute) { }

  ngOnInit() {
    // when root uuid changes, update page.
    this.rootPageIndexSub = this.treeManager.getRootIndex().subscribe(
      index => {
        let rootNodes = this.treeManager.getRootNodes();
        this.rootPage = this.treeManager.getNode(rootNodes[index]);
        }
    );
    // push our ID to the treemanager
    this.rootIndexSub = this.route.params.subscribe(
      params => { 
        this.treeManager.setRootIndex(parseInt(params['id']));
      }
    );

    // get Unlock Status
    this.unlockStatusSub = this.AppSettingsService.getUnlockStatusAsO().subscribe(
      unlockStatus => {
        this.unlockStatus = unlockStatus;
      }
    );

  }

  ngOnDestroy() {
    this.rootIndexSub.unsubscribe();
    this.rootPageIndexSub.unsubscribe();
  }
}
