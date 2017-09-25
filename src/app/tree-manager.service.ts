import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { AppSettingsService } from './app-settings.service';

export class TreeNode {
  uuid: string = '';
  name: string = '';
  nodeType: string = null;
  nodeData: any = [];
}

export class TreeLink {
  parent: string;
  child: string;
}

@Injectable()
export class TreeManagerService {

  TreeNodes: TreeNode[] = [];
  TreeLinks: TreeLink[] = [];
  
  activeRootIndex: Subject<number> = new Subject<number>();

  constructor( private AppSettingsService: AppSettingsService) { 
    //this.TreeNodes = AppSettingsService.loadTreeNodes();
    //this.TreeLinks = AppSettingsService.loadTreeLinks();
  }

  private newUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
  }

  setRootIndex(index:number) {
    let rootNodes = this.getRootNodes();
    if ( (index > (Object.keys(rootNodes).length -1)) || index < 0) {
      index = 0;
    }
    this.activeRootIndex.next(index);
  }

  getRootIndex(): Observable<any> {
    return this.activeRootIndex.asObservable();
  }

  getRootNodes() {
    let rootNodes = [];
    for (var link of this.TreeLinks) {
      if (link.parent == 'ROOT') {
        rootNodes.push(link.child);
      }
    }
    return rootNodes;
  }

  getNode(uuid: string) {
      return this.TreeNodes.find(node => node.uuid == uuid);
  }
  
  newNode(parent: string) {
      let uuid = this.newUuid();
      this.TreeNodes.push({ uuid: uuid, name: "New Page", nodeType: "WidgetBlank", nodeData: null });
      this.TreeLinks.push({ parent: parent, child: uuid });  
      this.saveTree(); // save to localstorage  
      return uuid;
  }

  updateNodeType(uuid: string, newNodeType: string) {
    let nodeIndex = this.TreeNodes.findIndex(node => node.uuid == uuid)
    // TODO delete tree under this node...
    this.TreeNodes[nodeIndex].nodeData = null;
    this.TreeNodes[nodeIndex].nodeType = newNodeType;
    this.saveTree(); // save to localstorage  

  }

  saveNodeData(uuid: string, newNodeData) {
    let nodeIndex = this.TreeNodes.findIndex(node => node.uuid == uuid)
    this.TreeNodes[nodeIndex].nodeData = newNodeData;
    this.saveTree(); // save to localstorage  

  }


  saveTree() {
    //this.AppSettingsService.saveTree(this.TreeNodes, this.TreeLinks);
  }

}
