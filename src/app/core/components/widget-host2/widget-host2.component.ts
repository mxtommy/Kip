import { Component, inject, Type, ViewChild, ViewContainerRef, AfterViewInit, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import type { NgCompInputs } from 'gridstack/dist/angular';
import { BaseWidget } from 'gridstack/dist/angular';
import { WidgetStreamsDirective } from '../../directives/widget-streams.directive';
import { WidgetMetaDirective } from '../../directives/widget-meta.directive';
import { DialogService } from '../../services/dialog.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';
import { WidgetNumericViewComponent } from '../../../widgets/widget-numeric/widget-numeric-view.component';

@Component({
  selector: 'widget-host2',
  imports: [ MatCardModule, MatBottomSheetModule, GestureDirective ],
  templateUrl: './widget-host2.component.html',
  styleUrl: './widget-host2.component.scss',
  hostDirectives: [
    { directive: WidgetStreamsDirective },
    { directive: WidgetMetaDirective }
  ]
})
export class WidgetHost2Component extends BaseWidget implements AfterViewInit {
  // Gridstack supplies a single widgetProperties object - does NOT support input signal yet
  @Input({ required: true }) protected widgetProperties!: IWidget;
  @ViewChild('childOutlet', { read: ViewContainerRef, static: false }) private outlet!: ViewContainerRef;
  private readonly _dialog = inject(DialogService);
  protected readonly _dashboard = inject(DashboardService);
  private readonly _bottomSheet = inject(MatBottomSheet);
  private readonly _streams = inject(WidgetStreamsDirective, { optional: true });
  private readonly _meta = inject(WidgetMetaDirective, { optional: true });
  private _childCreated = false;

  constructor() {
    super();
  }

  public override serialize(): NgCompInputs {
    return { widgetProperties: this.widgetProperties as IWidget } as NgCompInputs;
  }

  ngAfterViewInit(): void {
    this.applyRuntimeConfig(); // initial apply
    this.createChildIfNeeded();
  }

  private createChildIfNeeded(): void {
    if (this._childCreated) return;
  const outlet = this.outlet;
  if (!outlet) return;
    const type = this.widgetProperties.type;
    if (!type) return;
    const childRef = outlet.createComponent(WidgetNumericViewComponent as Type<unknown>);
    const inst = childRef.instance as { widgetProperties?: IWidget };
    if (inst && 'widgetProperties' in inst) {
      inst.widgetProperties = this.widgetProperties;
    }
    this._childCreated = true;
  }

  private applyRuntimeConfig(cfg?: IWidgetSvcConfig): void {
    if (cfg) this.widgetProperties.config = cfg; // Update widget config

    this._streams?.setStreamsConfig?.(this.widgetProperties.config);
    this._streams?.setStreamsWidget?.(this.widgetProperties);
    this._meta?.setMetaConfig?.(this.widgetProperties.config);
    this._meta?.setMetaWidget?.(this.widgetProperties);
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
