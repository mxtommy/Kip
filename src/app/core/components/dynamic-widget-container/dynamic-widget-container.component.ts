/**
 * This component is hosted in layout-split and handles Widget framework operations and
 * dynamic instantiation.
 */
import { Component, OnInit, OnDestroy, Input, Inject, ViewChild, ViewContainerRef, ElementRef, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { UntypedFormControl, FormsModule } from '@angular/forms';
import { cloneDeep } from "lodash-es";

import { DynamicWidgetDirective } from '../../directives/dynamic-widget.directive';
import { DynamicWidget, IWidget } from '../../interfaces/widgets-interface';
import { ModalWidgetConfigComponent } from '../../../widget-config/modal-widget-config/modal-widget-config.component';
import { AppSettingsService } from '../../services/app-settings.service';
import { WidgetManagerService } from '../../services/widget-manager.service';
import { WidgetListService, widgetList } from '../../services/widget-list.service';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { MatMiniFabButton, MatButton } from '@angular/material/button';
import { KeyValuePipe } from '@angular/common';
import { MatCard } from '@angular/material/card';
import { AppService, ITheme } from '../../services/app-service';


@Component({
    selector: 'app-dynamic-widget-container',
    templateUrl: './dynamic-widget-container.component.html',
    styleUrls: ['./dynamic-widget-container.component.scss'],
    standalone: true,
    imports: [MatCard, DynamicWidgetDirective, MatMiniFabButton]
})
export class DynamicWidgetContainerComponent implements OnInit, OnDestroy {
  @Input('splitUUID') splitUUID: string;   // Get UUID from layout-split. We use it as the widgetUUID later for the widget
  @Input('unlockStatus') unlockStatus: boolean; // From layout-split.
  @ViewChild(DynamicWidgetDirective, {static: true, read: ViewContainerRef}) dynamicWidgetContainerRef : ViewContainerRef; // Parent layout-split container ref

  private themeNameSub: Subscription = null;
  private themeColorSubscription: Subscription = null;
  private themeChangeTimer = null;
  private splitWidgetSettings: IWidget;
  private themeColor: ITheme = null;
  public widgetInstance;

  constructor(
    public dialog: MatDialog,
    private appSettingsService: AppSettingsService, // need for theme change subscription
    private WidgetManagerService: WidgetManagerService,
    private widgetListService: WidgetListService,
    private app: AppService) { }

  ngOnInit() {
    this.themeColorSubscription = this.app.cssThemeColorRoles$.subscribe(t => this.themeColor = t);
    this.subscribeTheme();

  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.splitUUID && !changes.splitUUID.firstChange) {
      this.instantiateWidget();
    }

    if (changes.unlockStatus && !changes.unlockStatus.firstChange) {
      if(this.splitWidgetSettings.type == 'WidgetTutorial') {
        this.widgetInstance.unlockStatus = this.unlockStatus;  // keep for Tutorial Widget
      }
    }
  }

  ngOnDestroy(): void {
    this.themeNameSub?.unsubscribe();
    this.themeColorSubscription?.unsubscribe();
    clearTimeout(this.themeChangeTimer);
  }

  private instantiateWidget(): void {
    this.splitWidgetSettings = null;
    // Use parent layout-split UUID to find configured target Widget. Split UUID is used for Widget UUID
    this.splitWidgetSettings = cloneDeep(this.WidgetManagerService.getWidget(this.splitUUID)); // get from parent
    const widgetComponentTypeName = this.widgetListService.getComponentName(this.splitWidgetSettings.type);

    // Dynamically create component.
    this.widgetInstance = null;
    this.dynamicWidgetContainerRef.clear(); // remove virgin container ref
    const dynamicWidget = this.dynamicWidgetContainerRef.createComponent<DynamicWidget>(widgetComponentTypeName);
    this.widgetInstance = dynamicWidget.instance;
    if (this.splitWidgetSettings.config == null) {
      this.loadWidgetDefaults();
    }
    dynamicWidget.setInput('widgetProperties', this.splitWidgetSettings);
    dynamicWidget.setInput('theme', this.themeColor);
    if(this.splitWidgetSettings.type == 'WidgetTutorial') {
      dynamicWidget.setInput('unlockStatus', this.unlockStatus);  // keep for Tutorial Widget
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
            this.WidgetManagerService.updateWidgetType(this.splitUUID, result);
            this.instantiateWidget();
          }
        }
      }
    });

  }

  public openWidgetSettings(): void {
    const dialogRef = this.dialog.open(ModalWidgetConfigComponent, {
      data: cloneDeep(this.splitWidgetSettings.config)
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        this.splitWidgetSettings.config = cloneDeep(result); // copy all sub objects
        this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, this.splitWidgetSettings.config); // Push to storage
        this.instantiateWidget();
      }
    });
  }

  private loadWidgetDefaults(): void {
      this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, {...this.widgetInstance.defaultConfig}); // push default to manager service for storage
      this.splitWidgetSettings.config = this.widgetInstance.defaultConfig; // load default in current instance.
  }

  // We keep this for when we make a light theme
  private subscribeTheme() {
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
        this.themeChangeTimer = setTimeout(() => {   // delay so browser getComputedStyles has time to complete Material Theme style changes.
          this.instantiateWidget();
         }, 50);
    })
  }
}


@Component({
    selector: 'app-dynamic-widget-container-modal',
    templateUrl: './dynamic-widget-container.modal.html',
    styleUrls: ['./dynamic-widget-container.component.scss'],
    standalone: true,
    imports: [FormsModule, MatDialogTitle, MatDialogContent, MatTabGroup, MatTab, MatFormField, MatLabel, MatSelect, MatOption, MatDivider, MatDialogActions, MatButton, MatDialogClose, KeyValuePipe]
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
    // find index of the group containing the existing type;
    let index = 0;
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
