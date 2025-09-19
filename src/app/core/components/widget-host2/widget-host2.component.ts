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
    // Always persist merged runtime options. If options() undefined (should be rare), retain existing config.
    const merged = this._runtime?.options();
    if (merged) {
      this.widgetProperties.config = merged;
    } else if (!this.widgetProperties.config) {
      // As a final fallback ensure config is at least an empty object to avoid Gridstack persisting undefined
      this.widgetProperties.config = {} as IWidgetSvcConfig;
    }
    return { widgetProperties: this.widgetProperties as IWidget } as NgCompInputs;
  }

  ngAfterViewInit(): void {
    this.createChildIfNeeded();
  }

  private createChildIfNeeded(): void {
    if (!this.outlet) return;
    const type = this.widgetProperties.type;
    if (!type) return;
    const resolved = this._widgetService.getComponentType(type) as Type<WidgetViewComponentBase> | undefined;
    const compType = resolved;

    // 1. Obtain default config without forcing a full component instantiation when possible.
    // Try static DEFAULT_CONFIG pattern first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let defaultCfg: IWidgetSvcConfig | undefined = compType && (compType as any).DEFAULT_CONFIG;
    if (!defaultCfg && compType) {
      // Fallback: temporary instance solely to read instance defaultConfig, then destroy.
      const tempRef = this.outlet.createComponent(compType);
      defaultCfg = (tempRef.instance as WidgetViewComponentBase).defaultConfig;
      tempRef.destroy();
    }

    // 2. Initialize runtime with merged config prior to creating the visual component so streams/meta can bind early.
    if (this._runtime?.initialize) {
      this._runtime.initialize(defaultCfg, this.widgetProperties.config);
    } else {
      this._runtime?.defaultConfig.set(defaultCfg);
      if (this.widgetProperties.config) this._runtime?.setRuntimeConfig?.(this.widgetProperties.config);
    }
    const merged = this._runtime?.options();
    if (merged) this.widgetProperties.config = merged;

    // 3. Create the component BEFORE streams reobserve so it can subscribe early.
    if (compType) {
      const childRef = this.outlet.createComponent(compType);
      childRef.setInput('id', this.widgetProperties.uuid);
      childRef.setInput('type', this.widgetProperties.type);
    }
    // Initial diff-based streams wiring (registrations occur when child calls observe)
    this._streams?.applyStreamsConfigDiff?.(merged);
    this._meta?.applyMetaConfigDiff?.(merged);
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

    // Diff-based streams config (avoids full reset storm)
    this._streams?.applyStreamsConfigDiff?.(runtimeCfg);
    this._meta?.applyMetaConfigDiff?.(runtimeCfg);
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
