import { Component, OnInit, Input, Inject, ComponentFactoryResolver, ComponentRef, ViewChild } from '@angular/core';
import { MdDialog, MdDialogRef, MD_DIALOG_DATA } from '@angular/material';
import { NgModel } from '@angular/forms';

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


  activeWidget: IWidget;
  instance;
  private componentRef: ComponentRef<{}>;

  constructor(
      private componentFactoryResolver: ComponentFactoryResolver,
      public dialog: MdDialog,
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    let componentName = this.widgetListService.getComponentName(this.activeWidget.type);

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

  selectWidget() {
    let dialogRef = this.dialog.open(UnitWindowModalComponent, {
      
      data: { currentType: this.activeWidget.type }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (this.activeWidget.type != result) {
        this.WidgetManagerService.updateWidgetType(this.widgetUUID, result);
        this.ngOnInit();
      }
    });
    
  }

}

export abstract class DynamicComponentData {
    widgetUUID: string;
    unlockStatus: boolean;
}


@Component({
  selector: 'app-unit-window-modal',
  templateUrl: './unit-window.modal.html',
  styleUrls: ['./unit-window.component.css']
})
export class UnitWindowModalComponent implements OnInit {

  newWidget: string;
  widgetList: widgetInfo[];
  
  
  constructor(
    private widgetListService: WidgetListService,
    public dialogRef: MdDialogRef<UnitWindowModalComponent>,
    @Inject(MD_DIALOG_DATA) public data: any) { }

  onNoClick(): void {
    this.dialogRef.close();
  }


  ngOnInit() {
    this.widgetList = this.widgetListService.getList();
    this.newWidget = this.data.currentType;
  }

  submitNewWidget() {
      this.dialogRef.close(this.newWidget);
  }
  
}
