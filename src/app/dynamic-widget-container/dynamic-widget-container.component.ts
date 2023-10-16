/**
 * This component is hosted in layout-split and handles Widget framework operations and
 * dynamic instanciation.
 */
import { Component, OnInit, Input, Inject, ComponentRef, ViewChild, ViewContainerRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UntypedFormControl } from '@angular/forms';
import { cloneDeep } from "lodash-es";

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { DynamicWidgetDirective } from '../dynamic-widget.directive';
import { WidgetListService, widgetList } from '../widget-list.service';

/**
 * Used to add data properties to ComponentRef/Widgets so they are exposed as
 * @input() decorators in the Widget instance.
 *
 * @export
 * @abstract
 * @class DynamicComponentData
 */
export abstract class DynamicComponentData {
  unlockStatus: boolean;
  widgetProperties: IWidget;
  widgetUUID: string;
}


@Component({
  selector: 'app-dynamic-widget-container',
  templateUrl: './dynamic-widget-container.component.html',
  styleUrls: ['./dynamic-widget-container.component.css']
})
export class DynamicWidgetContainerComponent implements OnInit {
  @Input('splitUUID') splitUUID: string;   // Get UUID from layout-split. We use it as the widgetUUID later for the widget
  @Input('unlockStatus') unlockStatus: boolean; // From layout-split.
  @ViewChild(DynamicWidgetDirective, {static: true, read: ViewContainerRef}) dynamicWidgetContainerRef : ViewContainerRef; // Parent layout-split container ref


  private splitWidgetSettings: IWidget;
  public widgetInstance;
  private newContainerRefRef: ComponentRef<{}>;

  constructor(
      public dialog: MatDialog,
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.widgetInstance = null;
    this.splitWidgetSettings = null;
    // Use parent layout-split UUID to find configured target Widgett. Split UUID is used for Widget UUID
    this.splitWidgetSettings = this.WidgetManagerService.getWidget(this.splitUUID); // get from parent
    const widgetComponentTypeName = this.widgetListService.getComponentName(this.splitWidgetSettings.type);

    // Dynamically create containerRef.
    // this.dynamicWidgetContainerRef.clear(); // remove vergin container ref
    this.newContainerRefRef = this.dynamicWidgetContainerRef.createComponent(widgetComponentTypeName);

    // Init and add abstract class data properties and inject properties into Widget
    this.widgetInstance = <DynamicComponentData> this.newContainerRefRef.instance;
    if (this.splitWidgetSettings.config == null) {
      this.loadWidgetDefaults();
    }
    this.widgetInstance.unlockStatus = this.unlockStatus;  //TODO(David): Remove once all Widget are updated
    this.widgetInstance.widgetProperties = this.splitWidgetSettings;
    this.widgetInstance.widgetUUID = this.splitWidgetSettings.uuid;  //TODO(David): Remove once all Widget are updated
  }

  ngOnChanges(changes: any) {
    if ( ('widgetUUID' in changes ) && (!changes.widgetUUID.firstChange)) {
      this.ngOnInit();
    }

    if ( ('unlockStatus' in changes ) && (!changes.unlockStatus.firstChange)) {
      this.widgetInstance.unlockStatus = this.unlockStatus;  //TODO(David): Remove once all Widget are updated
    }

  }

  public selectWidget(): void {
    let dialogRef = this.dialog.open(DynamicWidgetContainerModalComponent, {

      data: { currentType: this.splitWidgetSettings.type }
    });

    dialogRef.afterClosed().subscribe(result => {
      let fullWidgetList = this.widgetListService.getList();
      for (let [group, widgetList] of Object.entries(fullWidgetList)) {
        if (widgetList.findIndex(w => w.name == result) >= 0 ) {
          if (this.splitWidgetSettings.type != result) {
            this.dynamicWidgetContainerRef.clear(); // remove vergin container ref
            this.WidgetManagerService.updateWidgetType(this.splitUUID, result);
            this.ngOnInit();
          }
        }
      }
    });

  }

  public openWidgetSettings(): void {
    const dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: {...this.splitWidgetSettings.config}
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        if (result.paths != undefined) {
          var OrgPaths = {...this.splitWidgetSettings.config.paths}; // keep old paths to combine with results if some paths are missing
          var CombPaths = {...OrgPaths, ...result.paths};
          this.splitWidgetSettings.config = cloneDeep(result); // copy all sub objects
          this.splitWidgetSettings.config.paths = {...CombPaths};
        } else {
          this.splitWidgetSettings.config = cloneDeep(result); // copy all sub objects
        }

        this.dynamicWidgetContainerRef.clear();
        this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, this.splitWidgetSettings.config); // Push to storage
        this.ngOnInit();
      }
    });
  }

  private loadWidgetDefaults(): void {
      this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, {...this.widgetInstance.defaultConfig}); // push default to manager service for storage
      this.splitWidgetSettings.config = this.widgetInstance.defaultConfig; // load default in current intance.
  }
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
