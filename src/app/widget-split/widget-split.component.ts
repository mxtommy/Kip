import { Component, OnInit, Input } from '@angular/core';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeNode, TreeManagerService } from '../tree-manager.service';

export class WidgetSplitConfig {
  orientation: boolean //true for row, false for col
  children: WidgetSplitChildren[]
}

export class WidgetSplitChildren {
  uuid: string
  order: number
  ratio: number
}


@Component({
  selector: 'app-widget-split',
  templateUrl: './widget-split.component.html',
  styleUrls: ['./widget-split.component.css']
})

export class WidgetSplitComponent implements OnInit {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('nodeUUID') nodeUUID: string;

  constructor(private modalService: NgbModal, private treeManager: TreeManagerService) {}

  //Variables
  activePage: TreeNode;
  modalRef;




  ngOnInit() {
      this.activePage = this.treeManager.getNode(this.nodeUUID);
      if (this.activePage.nodeData === null) {
        // no data, let's set some!
        
        // first we need our two new pages
        let newNode1 = this.treeManager.newNode(this.activePage.uuid);
        let newNode2 = this.treeManager.newNode(this.activePage.uuid);

        //layout
        this.activePage.nodeData = <WidgetSplitConfig> {
          orientation: true, // row
          children: [
            {
              uuid: newNode1,
              order: 2,
              ratio: 1
            },
            {
              uuid: newNode2,
              order: 1,
              ratio: 3
            }            
          ]
        } // end layout
        this.treeManager.saveNodeData(this.activePage.uuid, this.activePage.nodeData);
      } // end if null

      

  }



  openWidgetSettings(content) {
    this.modalRef = this.modalService.open(content);
    this.modalRef.result.then((result) => {
    }, (reason) => {
    });
  }



  
}
