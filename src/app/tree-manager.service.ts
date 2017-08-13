import { Injectable } from '@angular/core';

export class TreeNode {
  uuid: string;
  name: string;
  nodeType: string;
  nodeData;
}

export class TreeLink {
  parent: string;
  child: string;
}

@Injectable()
export class TreeManagerService {

  TreeNodes: TreeNode[] = [];
  TreeLinks: TreeLink[] = [];
  
  constructor() { }

  private newUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
  }

  ngOnInit() {
  }

  getRootNodes() {
    // init if nothing.
    if (Object.keys(this.TreeNodes).length == 0) {
      let uuid = this.newUuid();
      this.TreeNodes = [ { uuid: uuid, name: "Home Page", nodeType: "WidgetSplit", nodeData: null } ];
      this.TreeLinks = [ { parent: 'ROOT', child: uuid }];
    }

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
