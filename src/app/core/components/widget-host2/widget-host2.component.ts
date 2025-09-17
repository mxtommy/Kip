import { Component, inject, input, signal, effect } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../directives/widget-streams.directive';
import { WidgetMetaDirective } from '../../directives/widget-meta.directive';
import { DialogService } from '../../services/dialog.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';

@Component({
  selector: 'widget-host2',
  imports: [ MatCardModule, MatBottomSheetModule, GestureDirective ],
  templateUrl: './widget-host2.component.html',
  styleUrl: './widget-host2.component.scss',
  hostDirectives: [
    {
      directive: WidgetRuntimeDirective,
      inputs: [
        'runtimeWidget: runtimeWidget',
        'runtimeDefaultConfig: runtimeDefaultConfig',
        'runtimeConfig: runtimeConfig'
      ]
    },
    { directive: WidgetStreamsDirective },
    { directive: WidgetMetaDirective }
  ]
})
export class WidgetHost2Component {
  protected config = input.required<IWidgetSvcConfig>();
  private _config = signal<IWidgetSvcConfig | undefined>(undefined);
  protected id = input.required<string>();
  protected runtimeWidget = input.required<IWidget>();
  protected runtimeDefaultConfig = input<IWidgetSvcConfig>();
  protected runtimeConfig = input<IWidgetSvcConfig>();
  // No longer require forwarding inputs; host2 sets them programmatically

  private _dialog = inject(DialogService);
  protected _dashboard = inject(DashboardService);
  private _bottomSheet = inject(MatBottomSheet);
  private _runtime = inject(WidgetRuntimeDirective, { optional: true });
  private _streams = inject(WidgetStreamsDirective, { optional: true });
  private _meta = inject(WidgetMetaDirective, { optional: true });

  constructor() {
    // Mirror external input into internal _config
    effect(() => {
      const inCfg = this.config();
      if (inCfg) this._config.set(inCfg);
    });

    // Drive runtime/streams/meta off internal _config
    effect(() => {
      const c = this._config();
      if (!c) return;
      this._runtime?.setRuntimeConfig?.(c);
      this._streams?.setStreamsConfig?.(c);
      this._streams?.setStreamsWidget?.(this.runtimeWidget());
      this._meta?.setMetaConfig?.(c);
      this._meta?.setMetaWidget?.(this.runtimeWidget());
      this._streams?.resetAndReobserve?.();
      this._meta?.resetAndReobserve?.();
    });
  }

  public openWidgetOptions(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    if (!this._dashboard.isDashboardStatic()) {
      if (!this._config()) return;
      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: this._config(),
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        if (result) {
          // Apply to widget + programmatic runtime so serialize() and runtime agree
          this._runtime?.applyConfigToWidget?.(result);
          // Fan out to runtime/streams/meta via internal config
          this._config.set(result);
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
            this._dashboard.deleteWidget(this.id());
            break;
          case 'duplicate':
            this._dashboard.duplicateWidget(this.id());
            break;
          default:
            break;
        }
      });
    }
  }
}
