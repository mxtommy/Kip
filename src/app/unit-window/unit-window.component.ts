import { Component, OnInit, Input, ComponentFactoryResolver, ComponentRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgModel } from '@angular/forms';
import { NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetListService, widgetInfo } from '../widget-list.service';

@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})


export class UnitWindowComponent implements OnInit {
  @Input('nodeUUID') nodeUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild(DynamicWidgetDirective) dynamicWidget: DynamicWidgetDirective;

  widgetList: widgetInfo[];

  modalRef;
  activePage: TreeNode;
  instance;
  newWidget: string; //Used in change modal form.
  private componentRef: ComponentRef<{}>;

  constructor(
      private modalService: NgbModal,
      private componentFactoryResolver: ComponentFactoryResolver,
      private treeManager: TreeManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.widgetList = this.widgetListService.getList();
    this.activePage = this.treeManager.getNode(this.nodeUUID);
    this.newWidget  = this.activePage.nodeType;
    let componentName = this.widgetListService.getComponentName(this.activePage.nodeType);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentName);
    let viewContainerRef = this.dynamicWidget.viewContainerRef;
    viewContainerRef.clear();
    this.componentRef = viewContainerRef.createComponent(componentFactory);

    // inject info into new component
    this.instance = <DynamicComponentData> this.componentRef.instance;
    this.instance.nodeUUID = this.nodeUUID;
    this.instance.unlockStatus = this.unlockStatus;
  }

  ngOnChanges(changes: any) {
//    this.ngOnInit();

    if ( ('nodeUUID' in changes ) && (changes.nodeUUID.firstChange === false)) {
      this.ngOnInit();
    }


    if ( ('unlockStatus' in changes ) && (changes.unlockStatus.firstChange === false)) {
      this.instance.unlockStatus = this.unlockStatus;
    }

  }

  openWidgetSelector(content) {
    this.modalRef = this.modalService.open(content);
    this.modalRef.result.then((result) => {
    }, (reason) => {
    });
  }

  changeWidget() {
    this.modalRef.close();
    if (this.activePage.nodeType != this.newWidget) {
      this.treeManager.updateNodeType(this.nodeUUID, this.newWidget);
      this.ngOnInit();
    }
  }

}

export abstract class DynamicComponentData {
    nodeUUID: string;
    unlockStatus: boolean;
}