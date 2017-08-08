import { Component } from '@angular/core';

import { SignalKService } from './signalk.service';
import { TreeNode, TreeManagerService } from './tree-manager.service';

@Component({
  selector: 'app-root',
  providers: [SignalKService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  rootPages:string[] = [];
  rootIndex: number = 0;
  activePage: TreeNode;

  constructor(private signalKService: SignalKService, private treeManager: TreeManagerService) { }

  unlockStatus: boolean = false; 

  unlockPage() {
    if (this.unlockStatus) {
      console.log("Locking");
      this.unlockStatus = false;
    } else {
      console.log("Unlocking");
      this.unlockStatus = true;
    }

  }

  ngOnInit() {
      this.rootPages = this.treeManager.getRootNodes();
      this.activePage = this.treeManager.getNode(this.rootPages[this.rootIndex])
  }

  newPage() {
      let newguid = this.treeManager.newNode('ROOT');
      //  set active page to new GUID
      this.activePage = this.treeManager.getNode(newguid);
      //get new root list, set index to new page
      this.rootPages = this.treeManager.getRootNodes();
      this.rootIndex = this.rootPages.indexOf(newguid);
  }

  deletePage() {
    
  }

  pageDown() {
    if (this.rootIndex == 0) {
      this.rootIndex = (Object.keys(this.rootPages).length - 1);
    } else {
      this.rootIndex = this.rootIndex - 1;
    }
    this.activePage = this.treeManager.getNode(this.rootPages[this.rootIndex]);
  }

  pageUp() {
    if (this.rootIndex == (Object.keys(this.rootPages).length -1)) {
      this.rootIndex = 0;
    } else {
      this.rootIndex = this.rootIndex + 1;
    }
    this.activePage = this.treeManager.getNode(this.rootPages[this.rootIndex]);
  }

}
