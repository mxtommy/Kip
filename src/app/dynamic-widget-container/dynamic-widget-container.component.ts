/**
 * This component is hosted in layout-split and handles Widget framework operations and
 * dynamic instantiation.
 */
import { Component, OnInit, OnDestroy, Input, Inject, ViewChild, ViewContainerRef, ElementRef, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UntypedFormControl } from '@angular/forms';
import { cloneDeep } from "lodash-es";

import { DynamicWidgetDirective } from '../dynamic-widget.directive';
import { DynamicWidget, IWidget, ITheme } from '../widgets-interface';
import { ModalWidgetConfigComponent } from '../widget-config/modal-widget-config/modal-widget-config.component';
import { AppSettingsService } from '../app-settings.service';
import { WidgetManagerService } from '../widget-manager.service';
import { WidgetListService, widgetList } from '../widget-list.service';


@Component({
  selector: 'app-dynamic-widget-container',
  templateUrl: './dynamic-widget-container.component.html',
  styleUrls: ['./dynamic-widget-container.component.scss']
})
export class DynamicWidgetContainerComponent implements OnInit, OnDestroy {
  @Input('splitUUID') splitUUID: string;   // Get UUID from layout-split. We use it as the widgetUUID later for the widget
  @Input('unlockStatus') unlockStatus: boolean; // From layout-split.
  @ViewChild(DynamicWidgetDirective, {static: true, read: ViewContainerRef}) dynamicWidgetContainerRef : ViewContainerRef; // Parent layout-split container ref

  // hack to access material-theme palette colors
  @ViewChild('primary', {static: true, read: ElementRef}) private primary: ElementRef;
  @ViewChild('accent', {static: true, read: ElementRef}) private accent: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warn: ElementRef;
  @ViewChild('primaryDark', {static: true, read: ElementRef}) private primaryDark: ElementRef;
  @ViewChild('accentDark', {static: true, read: ElementRef}) private accentDark: ElementRef;
  @ViewChild('warnDark', {static: true, read: ElementRef}) private warnDark: ElementRef;
  @ViewChild('background', {static: true, read: ElementRef}) private background: ElementRef;
  @ViewChild('text', {static: true, read: ElementRef}) private text: ElementRef;
  @ViewChild('textDark', {static: true, read: ElementRef}) private textDark: ElementRef;
  @ViewChild('textPrimaryLight', {static: true, read: ElementRef}) private textPrimaryLight: ElementRef;
  @ViewChild('textPrimaryDark', {static: true, read: ElementRef}) private textPrimaryDark: ElementRef;
  @ViewChild('textAccentLight', {static: true, read: ElementRef}) private textAccentLight: ElementRef;
  @ViewChild('textAccentDark', {static: true, read: ElementRef}) private textAccentDark: ElementRef;
  @ViewChild('textWarnLight', {static: true, read: ElementRef}) private textWarnLight: ElementRef;
  @ViewChild('textWarnDark', {static: true, read: ElementRef}) private textWarnDark: ElementRef;

  private themeNameSub: Subscription = null;
  private splitWidgetSettings: IWidget;
  private themeColor: ITheme = {primary: '', accent: '', warn: '', primaryDark: '', accentDark: '', warnDark: '', background: '', text: '', textDark: '', textPrimaryLight: '', textPrimaryDark: '', textAccentLight:'', textAccentDark:'', textWarnLight:'', textWarnDark:''};
  public widgetInstance;

  constructor(
      public dialog: MatDialog,
      private appSettingsService: AppSettingsService, // need for theme change subscription
      private WidgetManagerService: WidgetManagerService,
      private widgetListService: WidgetListService) { }

  ngOnInit() {
    this.subscribeTheme();
  }

  private loadTheme(): void {
    this.themeColor.primary = getComputedStyle(this.primary.nativeElement).color;
    this.themeColor.accent = getComputedStyle(this.accent.nativeElement).color;
    this.themeColor.warn = getComputedStyle(this.warn.nativeElement).color;
    this.themeColor.primaryDark = getComputedStyle(this.primaryDark.nativeElement).color;
    this.themeColor.accentDark = getComputedStyle(this.accentDark.nativeElement).color;
    this.themeColor.warnDark = getComputedStyle(this.warnDark.nativeElement).color;
    this.themeColor.background = getComputedStyle(this.background.nativeElement).color;
    this.themeColor.text = getComputedStyle(this.text.nativeElement).color;
    this.themeColor.textDark = getComputedStyle(this.textDark.nativeElement).color;
    this.themeColor.textPrimaryLight = getComputedStyle(this.textPrimaryLight.nativeElement).color;
    this.themeColor.textPrimaryDark = getComputedStyle(this.textPrimaryDark.nativeElement).color;
    this.themeColor.textAccentLight = getComputedStyle(this.textAccentLight.nativeElement).color;
    this.themeColor.textAccentDark = getComputedStyle(this.textAccentDark.nativeElement).color;
    this.themeColor.textWarnLight = getComputedStyle(this.textWarnLight.nativeElement).color;
    this.themeColor.textWarnDark = getComputedStyle(this.textWarnDark.nativeElement).color;
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
    this.unsubscribeTheme();
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
      width: '80%',
      data: cloneDeep(this.splitWidgetSettings.config)
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

        // this.dynamicWidgetContainerRef.clear();
        this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, this.splitWidgetSettings.config); // Push to storage
        this.instantiateWidget();
      }
    });
  }

  private loadWidgetDefaults(): void {
      this.WidgetManagerService.updateWidgetConfig(this.splitWidgetSettings.uuid, {...this.widgetInstance.defaultConfig}); // push default to manager service for storage
      this.splitWidgetSettings.config = this.widgetInstance.defaultConfig; // load default in current instance.
  }

  private subscribeTheme() {
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
        setTimeout(() => {   // delay so browser getComputedStyles has time to complete Material Theme style changes.
          this.loadTheme();
          this.instantiateWidget();
         }, 50);
    })
  }

  private unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }
}


@Component({
  selector: 'app-dynamic-widget-container-modal',
  templateUrl: './dynamic-widget-container.modal.html',
  styleUrls: ['./dynamic-widget-container.component.scss']
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
