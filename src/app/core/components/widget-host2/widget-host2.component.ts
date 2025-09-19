import { Component, inject, Type, ViewChild, ViewContainerRef, AfterViewInit, Input, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import type { NgCompInputs } from 'gridstack/dist/angular';
import { BaseWidget } from 'gridstack/dist/angular';
import { WidgetStreamsDirective } from '../../directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../directives/widget-metadata.directive';
import { WidgetRuntimeDirective } from '../../directives/widget-runtime.directive';
import { DialogService } from '../../services/dialog.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';
import { WidgetService } from '../../services/widget.service';

// Base shape expected from view components (optional defaultConfig)
interface WidgetViewComponentBase { defaultConfig?: IWidgetSvcConfig }

@Component({
  selector: 'widget-host2',
  imports: [MatCardModule, MatBottomSheetModule, GestureDirective],
  templateUrl: './widget-host2.component.html',
  styleUrl: './widget-host2.component.scss',
  hostDirectives: [
    { directive: WidgetStreamsDirective },
    { directive: WidgetMetadataDirective },
    { directive: WidgetRuntimeDirective, outputs: ['runtimeConfig:'] }
  ]
})
export class WidgetHost2Component extends BaseWidget implements OnInit, AfterViewInit {
  // Gridstack supplies a single widgetProperties object - does NOT support input signal yet
  @Input({ required: true }) protected widgetProperties!: IWidget;
  @ViewChild('childOutlet', { read: ViewContainerRef, static: false }) private outlet!: ViewContainerRef;
  private readonly _dialog = inject(DialogService);
  protected readonly _dashboard = inject(DashboardService);
  private readonly _bottomSheet = inject(MatBottomSheet);
  private readonly _streams = inject(WidgetStreamsDirective, { optional: true });
  private readonly _meta = inject(WidgetMetadataDirective, { optional: true });
  private readonly _runtime = inject(WidgetRuntimeDirective, { optional: true });
  private _childCreated = false;
  private readonly _widgetService = inject(WidgetService);

  constructor() {
    super();
  }

  ngOnInit(): void {
    // If there is a saved config, seed runtime now (default will merge once child provides it)
    if (this.widgetProperties?.config) {
      this._runtime?.setRuntimeConfig?.(this.widgetProperties.config);
    }
  }

  public override serialize(): NgCompInputs {
    // Always persist merged runtime options
    this.widgetProperties.config = this._runtime?.options();
    return { widgetProperties: this.widgetProperties as IWidget } as NgCompInputs;
  }

  ngAfterViewInit(): void {
    this.createChildIfNeeded();
  }

  private createChildIfNeeded(): void {
    if (!this.outlet) return;
    const type = this.widgetProperties.type;
    if (!type) return;
    const resolved = this._widgetService.getComponentType(type);
    const compType = (resolved as Type<WidgetViewComponentBase>);
    const childRef = this.outlet.createComponent(compType);
    childRef.setInput('id', this.widgetProperties.uuid);
    childRef.setInput('type', this.widgetProperties.type);
    // Support components exposing defaultConfig field; if absent treat as undefined
    const defaultConfig = childRef.instance.defaultConfig as IWidgetSvcConfig | undefined;
    // Initialize runtime with both default + saved (if any). This will immediately produce merged options.
    if (this._runtime?.initialize) {
      this._runtime.initialize(defaultConfig, this.widgetProperties.config);
    } else {
      // Fallback for safety
      this._runtime?.defaultConfig.set(defaultConfig);
    }
    const merged = this._runtime?.options();
    if (merged) {
      this.widgetProperties.config = merged;
    }
    this.applyRuntimeConfig(merged);
    this._childCreated = true;
  }

  private applyRuntimeConfig(cfg?: IWidgetSvcConfig): void {
    if (cfg) {
      // Update widget config
      this._runtime?.setRuntimeConfig?.(cfg);
    }
    const runtimeCfg = this._runtime.options();
    if (runtimeCfg) {
      this.widgetProperties.config = runtimeCfg;
    }

    this._streams?.setStreamsConfig?.(runtimeCfg);
    this._meta?.setMetaConfig?.(runtimeCfg);
    this._streams?.resetAndReobserve?.();
    this._meta?.resetAndReobserve?.();
  }

  public openWidgetOptions(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    if (!this._dashboard.isDashboardStatic()) {
      if (!this.widgetProperties) return;
      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: this.widgetProperties.config,
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        if (result) {
          this.applyRuntimeConfig(result);
        }
      });
    }
  }

  public openBottomSheet(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    if (!this._dashboard.isDashboardStatic()) {
      const isLinuxFirefox = typeof navigator !== 'undefined' &&
        /Linux/.test(navigator.platform) &&
        /Firefox/.test(navigator.userAgent);
      const sheetRef = this._bottomSheet.open(WidgetHostBottomSheetComponent, isLinuxFirefox ? { disableClose: true, data: { showCancel: true } } : {});
      sheetRef.afterDismissed().subscribe((action) => {
        switch (action) {
          case 'delete':
            this._dashboard.deleteWidget(this.widgetProperties.uuid);
            break;
          case 'duplicate':
            this._dashboard.duplicateWidget(this.widgetProperties.uuid);
            break;
          default:
            break;
        }
      });
    }
  }
}
