import { Component, OnInit, Input, ComponentFactoryResolver, ViewChild } from '@angular/core';
import { NgModel } from '@angular/forms';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetBlankComponent } from '../widget-blank/widget-blank.component';
import { WidgetSplitComponent } from '../widget-split/widget-split.component';
import { WidgetUnknownComponent } from '../widget-unknown/widget-unknown.component';

export class widgetInfo {
  name: string;
  componentName;
  description: string;
}


@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})


export class UnitWindowComponent implements OnInit {
  @Input('unlockStatus') unlockStatus: string;
  @Input('nodeGUID') nodeGUID: string;
  @ViewChild(DynamicWidgetDirective) dynamicWidget: DynamicWidgetDirective;


  widgetList: widgetInfo[] = 
  [
    {
      name: 'WidgetBlank',
      componentName: WidgetBlankComponent,
      description: 'Blank'
    },
    {
      name: 'WidgetSplit',
      componentName: WidgetSplitComponent,
      description: 'Split in two'
    }
  ];

  modalRef;
  activePage: TreeNode;
  newWidget: string; //Used in change modal form.

  constructor(
      private modalService: NgbModal,
      private componentFactoryResolver: ComponentFactoryResolver,
      private treeManager: TreeManagerService) { }

  ngOnInit() {
    this.activePage = this.treeManager.getNode(this.nodeGUID);
    this.newWidget  = this.activePage.nodeType;
    let componentName = this.getComponentName(this.activePage.nodeType);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentName);
    let viewContainerRef = this.dynamicWidget.viewContainerRef;
    viewContainerRef.clear();
    let componentRef = viewContainerRef.createComponent(componentFactory);

  }

  ngOnChanges(changes: any) {
    this.ngOnInit();
  }

  openWidgetSelector(content) {
    this.modalRef = this.modalService.open(content);
    this.modalRef.result.then((result) => {
      //this.closeResult = `Closed with: ${result}`;
    }, (reason) => {
      //this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  changeWidget() {
    this.modalRef.close();
    if (this.activePage.nodeType != this.newWidget) {
      this.treeManager.updateNodeType(this.nodeGUID, this.newWidget);
      this.ngOnInit();
    }
  }

  private getComponentName(typeName: string) {
    let type = this.widgetList.find(c => c.name == typeName).componentName;
    return type || WidgetUnknownComponent;
  
  }

}
