import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs/Subscription';

import { SignalKService, pathObject } from '../signalk.service';
import { TreeNode, TreeManagerService } from '../tree-manager.service';


interface textWidgetConfig {
  signalKPath: string;
  signalKSource: string;
}

@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, OnDestroy {

  @Input('nodeUUID') nodeUUID: string;

  modalRef;

  settingsForm = {
    numberPaths: [],
    stringPaths: [],
    signalKPath: '',
    selfPaths: true //only show paths for own vessel
  }

  activePage: TreeNode;

  dataValue: any = '---';
  dataTimestamp: number = Date.now();

  nodeConfig: textWidgetConfig = {
    signalKPath: null,
    signalKSource: 'default'
  }

  //subs
  valueSub: Subscription = null;


  
  constructor(
    private modalService: NgbModal, 
    private SignalKService: SignalKService,
    private treeManager: TreeManagerService) {
  }

  ngOnInit() {
    this.activePage = this.treeManager.getNode(this.nodeUUID);
    if (this.activePage.nodeData === null) {
        // no data, let's set some!
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
    } else {
      this.nodeConfig = this.activePage.nodeData; // load existing config.
    }
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (this.nodeConfig.signalKPath === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.nodeUUID, this.nodeConfig.signalKPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }

        // TODO handle null...
        this.dataValue = pathObject.sources[pathObject.defaultSource].value;
        this.dataTimestamp = pathObject.sources[pathObject.defaultSource].timestamp;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
    }
  }

  openWidgetSettings(content) {
      //this.availablePaths = this.SignalKService.getNumberPaths(true);
      this.modalRef = this.modalService.open(content);
      this.modalRef.result.then((result) => {
      }, (reason) => {
      });
      this.settingsForm.numberPaths = this.SignalKService.getPathsByType('number');
      this.settingsForm.stringPaths = this.SignalKService.getPathsByType('string');
      console.log(this.settingsForm);
  }
  
  saveSettings() {
      this.modalRef.close();
  
  }

}
