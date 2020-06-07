import { Component, OnInit, Input, Inject, ComponentFactoryResolver, ComponentRef, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NgModel } from '@angular/forms';
import { FormControl } from '@angular/forms';

import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetListService, widgetList } from '../widget-list.service';

@Component({
  selector: 'app-unit-window',
  templateUrl: './unit-window.component.html',
  styleUrls: ['./unit-window.component.css']
})
export class UnitWindowComponent implements OnInit {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild(DynamicWidgetDirective, {static: true, read: ViewContainerRef}) dynamicWidget : ViewContainerRef;


  activeWidget: IWidget;
  instance;
  private componentRef: ComponentRef<{}>;

  constructor(
      private componentFactoryResolver: ComponentFactoryResolver,
      public dialog:MatDialog,
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    let componentName = this.widgetListService.getComponentName(this.activeWidget.type);

    //dynamically load component.
    let componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentName);
    // let viewContainerRef = this.dynamicWidget;
    // viewContainerRef.clear();
    this.dynamicWidget.clear();
    this.componentRef = this.dynamicWidget.createComponent(componentFactory);

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
      let fullWidgetList = this.widgetListService.getList();
      for (let [group, widgetList] of Object.entries(fullWidgetList)) {
        if (widgetList.findIndex(w => w.name == result) >= 0 ) {
          if (this.activeWidget.type != result) {
            this.WidgetManagerService.updateWidgetType(this.widgetUUID, result);
            this.ngOnInit();
          }
        }
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
  widgetList: widgetList;
  selectedTab = new FormControl(0);

  constructor(
    private widgetListService: WidgetListService,
    public dialogRef:MatDialogRef<UnitWindowModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  onNoClick(): void {
    this.dialogRef.close();
  }

  keepOrder = (a, b) => { // needed so that keyvalue filter doesn't resort
    return a;
  }

  ngOnInit() {
    this.widgetList = this.widgetListService.getList();
    this.newWidget = this.data.currentType;
    // find index of the group conatining the existing type;
    let index=0;
    for (let [group, groupWidgetList] of Object.entries(this.widgetList)) {
      if (groupWidgetList.findIndex(w => w.name == this.data.currentType) >= 0 ) {
        this.selectedTab.setValue(index);
        break;
      }
      index++;
    }

  }

  submitNewWidget() {
      this.dialogRef.close(this.newWidget);
  }

}
