/**
 * This component handles Widget selection and dynamic instanciation of Widgets
 */
import { Component, OnInit, Input, Inject, ComponentRef, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UntypedFormControl } from '@angular/forms';

import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';

import { WidgetListService, widgetList } from '../widget-list.service';

@Component({
  selector: 'app-dynamic-widget-container',
  templateUrl: './dynamic-widget-container.component.html',
  styleUrls: ['./dynamic-widget-container.component.css']
})
export class DynamicWidgetContainerComponent implements OnInit {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild(DynamicWidgetDirective, {static: true, read: ViewContainerRef}) dynamicWidget : ViewContainerRef;


  activeWidget: IWidget;
  widgetInstance;
  private componentRef: ComponentRef<{}>;

  constructor(
      public dialog:MatDialog,
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    // Get the active Widget's Component name from configuration, based on the UUID of current View.
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    const widgetComponentName = this.widgetListService.getComponentName(this.activeWidget.type);

    // Dynamically create component and attach to View.
    this.dynamicWidget.clear();
    this.componentRef = this.dynamicWidget.createComponent(widgetComponentName);

    // Inject details into new component
    this.widgetInstance = <DynamicComponentData> this.componentRef.instance;
    this.widgetInstance.widgetUUID = this.widgetUUID;
    this.widgetInstance.unlockStatus = this.unlockStatus;
  }

  ngOnChanges(changes: any) {
    if ( ('widgetUUID' in changes ) && (changes.widgetUUID.firstChange === false)) {
      this.ngOnInit();
    }

    if ( ('unlockStatus' in changes ) && (changes.unlockStatus.firstChange === false)) {
      this.widgetInstance.unlockStatus = this.unlockStatus;
    }

  }

  selectWidget() {
    let dialogRef = this.dialog.open(DynamicWidgetContainerModalComponent, {

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
  selector: 'app-dynamic-widget-container-modal',
  templateUrl: './dynamic-widget-container.modal.html',
  styleUrls: ['./dynamic-widget-container.component.css']
})
export class DynamicWidgetContainerModalComponent implements OnInit {

  newWidget: string;
  widgetList: widgetList;
  selectedTab = new UntypedFormControl(0);

  constructor(
    private widgetListService: WidgetListService,
    public dialogRef:MatDialogRef<DynamicWidgetContainerModalComponent>,
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
