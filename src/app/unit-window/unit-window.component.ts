import { Component, OnInit, Input, ComponentFactoryResolver, ViewChild } from '@angular/core';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetBlankComponent } from '../widget-blank/widget-blank.component';
import { WidgetSplitComponent } from '../widget-split/widget-split.component';


@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})
export class UnitWindowComponent implements OnInit {
  @Input('unlockStatus') unlockStatus: string;
  @Input('nodeGUID') nodeGUID: string;
  @ViewChild(DynamicWidgetDirective) dynamicWidget: DynamicWidgetDirective;

  activePage: TreeNode;

  constructor(
      private componentFactoryResolver: ComponentFactoryResolver,
      private treeManager: TreeManagerService) { }

  ngOnInit() {
    this.activePage = this.treeManager.getNode(this.nodeGUID);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(WidgetBlankComponent);
    let viewContainerRef = this.dynamicWidget.viewContainerRef;
    viewContainerRef.clear();
    let componentRef = viewContainerRef.createComponent(componentFactory);

  }

  ngOnChanges(changes: any) {
    this.ngOnInit();
  }

}
