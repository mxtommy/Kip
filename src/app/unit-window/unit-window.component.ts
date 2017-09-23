import { Component, OnInit, Input, ComponentFactoryResolver, ComponentRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgModel } from '@angular/forms';
import { NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';

import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetListService, widgetInfo } from '../widget-list.service';

@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})


export class UnitWindowComponent implements OnInit {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild(DynamicWidgetDirective) dynamicWidget: DynamicWidgetDirective;

  widgetList: widgetInfo[];

  modalRef;
  activePage: IWidget;
  instance;
  newWidget: string; //Used in change modal form.
  private componentRef: ComponentRef<{}>;

  constructor(
      private modalService: NgbModal,
      private componentFactoryResolver: ComponentFactoryResolver,
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.widgetList = this.widgetListService.getList();
    this.activePage = this.WidgetManagerService.getWidget(this.widgetUUID);
    this.newWidget  = this.activePage.type; // init form value to current
    let componentName = this.widgetListService.getComponentName(this.activePage.type);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentName);
    let viewContainerRef = this.dynamicWidget.viewContainerRef;
    viewContainerRef.clear();
    this.componentRef = viewContainerRef.createComponent(componentFactory);

    // inject info into new component
    this.instance = <DynamicComponentData> this.componentRef.instance;
    this.instance.widgetUUID = this.widgetUUID;
    this.instance.unlockStatus = this.unlockStatus;
  }

  ngOnChanges(changes: any) {
//    this.ngOnInit();

    if ( ('widgetUUID' in changes ) && (changes.widgetUUID.firstChange === false)) {
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
    if (this.activePage.type != this.newWidget) {
      this.WidgetManagerService.updateWidgetType(this.widgetUUID, this.newWidget);
      this.ngOnInit();
    }
  }

}

export abstract class DynamicComponentData {
    widgetUUID: string;
    unlockStatus: boolean;
}