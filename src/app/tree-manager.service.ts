import { Injectable } from '@angular/core';

export class TreeNode {
  id: string;
  name: string;
  nodeType: string;
  nodeData;
  nodeChildren: Array<string>;
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

  private newGuid() {
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
      let guid = this.newGuid();
      this.TreeNodes = [ { id: guid, name: "Home Page", nodeType: "WidgetBlank", nodeData: {}, nodeChildren: [] } ];
      this.TreeLinks = [ { parent: 'ROOT', child: guid }];
    }

    let rootNodes = [];
    for (var link of this.TreeLinks) {
      if (link.parent == 'ROOT') {
        rootNodes.push(link.child);
      }
    }
    return rootNodes;
  }

  getNode(guid: string) {
      return this.TreeNodes.find(node => node.id == guid);
  }
  
  newNode(parent: string) {
      let guid = this.newGuid();
      this.TreeNodes.push({ id: guid, name: "New Page", nodeType: "WidgetBlank", nodeData: {}, nodeChildren: [] });
      this.TreeLinks.push({ parent: parent, child: guid });    
      return guid;
  }

  updateNodeType(guid: string, newNodeType: string) {
    let nodeIndex = this.TreeNodes.findIndex(node => node.id == guid)
    // TODO delete tree under this node...
    this.TreeNodes[nodeIndex].nodeData = {};
    this.TreeNodes[nodeIndex].nodeType = newNodeType;
  }


}
