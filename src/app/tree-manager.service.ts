import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

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

  constructor() { 
            // init if nothing.
            if (Object.keys(this.TreeNodes).length == 0) {
              let uuid = this.newUuid();
              this.TreeNodes = [ { uuid: uuid, name: "Home Page", nodeType: "WidgetTextGeneric", nodeData: null } ];
              this.TreeLinks = [ { parent: 'ROOT', child: uuid }];
              //this.activeRootIndex.next(0);
            }
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
    console.log("Updated root index to: "+ index);
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
      return uuid;
  }

  updateNodeType(uuid: string, newNodeType: string) {
    let nodeIndex = this.TreeNodes.findIndex(node => node.uuid == uuid)
    // TODO delete tree under this node...
    this.TreeNodes[nodeIndex].nodeData = null;
    this.TreeNodes[nodeIndex].nodeType = newNodeType;
  }

  saveNodeData(uuid: string, newNodeData) {
    let nodeIndex = this.TreeNodes.findIndex(node => node.uuid == uuid)
    this.TreeNodes[nodeIndex].nodeData = newNodeData;
  }

}
