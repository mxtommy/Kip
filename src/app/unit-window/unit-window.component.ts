import { Component, OnInit, Input, ComponentFactoryResolver, ComponentRef, ViewChild } from '@angular/core';
import { NgModel } from '@angular/forms';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetListService, widgetInfo } from '../widget-list.service';

@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})


export class UnitWindowComponent implements OnInit {
  @Input('unlockStatus') unlockStatus: boolean;
  @Input('nodeGUID') nodeGUID: string;
  @ViewChild(DynamicWidgetDirective) dynamicWidget: DynamicWidgetDirective;


  widgetList: widgetInfo[];

  modalRef;
  activePage: TreeNode;
  newWidget: string; //Used in change modal form.
  private componentRef: ComponentRef<{}>;

  constructor(
      private modalService: NgbModal,
      private componentFactoryResolver: ComponentFactoryResolver,
      private treeManager: TreeManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.widgetList = this.widgetListService.getList();
    this.activePage = this.treeManager.getNode(this.nodeGUID);
    this.newWidget  = this.activePage.nodeType;
    let componentName = this.widgetListService.getComponentName(this.activePage.nodeType);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentName);
    let viewContainerRef = this.dynamicWidget.viewContainerRef;
    viewContainerRef.clear();
    this.componentRef = viewContainerRef.createComponent(componentFactory);

    // inject info into new component
    let instance = <DynamicComponentData> this.componentRef.instance;
    instance.nodeGUID = this.nodeGUID;
    instance.unlockStatus = this.unlockStatus;
  }

  ngOnChanges(changes: any) {
    this.ngOnInit();
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
      this.treeManager.updateNodeType(this.nodeGUID, this.newWidget);
      this.ngOnInit();
    }
  }

}

export abstract class DynamicComponentData {
    nodeGUID: string;
    unlockStatus: boolean;
}