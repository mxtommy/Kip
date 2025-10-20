import { Component, inject, Input, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { WidgetTitleComponent } from '../widget-title/widget-title.component';
import { DashboardService } from '../../services/dashboard.service';
import { GestureDirective } from "../../directives/gesture.directive";
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../directives/widget-runtime.directive';
import { DialogService } from '../../services/dialog.service';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { cloneDeep } from 'lodash-es';
import { BaseWidget, NgCompInputs } from 'gridstack/dist/angular';

@Component({
  selector: 'group-widget',
  imports: [WidgetTitleComponent, GestureDirective],
  templateUrl: './group-widget.component.html',
  styleUrl: './group-widget.component.scss',
  hostDirectives: [
    { directive: WidgetRuntimeDirective }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupWidgetComponent extends BaseWidget implements OnInit {
  // Gridstack supplies a single widgetProperties object - does NOT support input signal yet
  @Input({ required: true }) protected widgetProperties!: IWidget;
  protected readonly dashboard = inject(DashboardService);
  private readonly _dialog = inject(DialogService);
  private readonly _bottomSheet = inject(MatBottomSheet);
  protected readonly runtime = inject(WidgetRuntimeDirective);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    color: 'contrast'
  };
  private _sheetOpen = false;
  private _optionsOpen = false;

  constructor() {
    super()
  }

  ngOnInit(): void {
    // Resolve default and user configuration
    this.runtime?.initialize?.(GroupWidgetComponent.DEFAULT_CONFIG, this.widgetProperties.config);
  }

  /**
   * Gridstack persistence hook. Ensures we always write the merged runtime options
   * (default + user) so external dashboard storage stays in sync.
   * Falls back to an empty object to avoid Gridstack serializing `undefined`.
   * @returns Gridstack input mapping containing updated `widgetProperties`.
   */
  public override serialize(): NgCompInputs {
    const merged = this.runtime?.options();
    if (merged) {
      this.widgetProperties.config = merged;
    } else if (!this.widgetProperties.config) {
      // As a final fallback ensure config is at least an empty object to avoid Gridstack persisting undefined
      this.widgetProperties.config = {} as IWidgetSvcConfig;
    }
    return { widgetProperties: this.widgetProperties as IWidget } as NgCompInputs;
  }

  /**
  * Open the widget options dialog (skips when dashboard is static).
  * @param e Event used to stop propagation (click/context menu/etc.).
  */
  public openWidgetOptions(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    if (!this.dashboard.isDashboardStatic()) {
      if (this._optionsOpen) return;

      this._optionsOpen = true;

      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: cloneDeep(this.runtime.options()),
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        this._optionsOpen = false;
        if (result) {
          this.runtime.setRuntimeConfig(result);
        }
      });
    }
  }

  /**
   * Open the bottom sheet for widget management (delete / duplicate actions).
   * @param e Event used to stop propagation.
   */
  public openBottomSheet(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();

    if (!this.dashboard.isDashboardStatic()) {
      if (this._sheetOpen) return;

      this._sheetOpen = true;
      const isLinuxFirefox = typeof navigator !== 'undefined' &&
        /Linux/.test(navigator.platform) &&
        /Firefox/.test(navigator.userAgent);
      const sheetRef = this._bottomSheet.open(WidgetHostBottomSheetComponent, isLinuxFirefox ? { disableClose: true, data: { showCancel: true } } : {});
      sheetRef.afterDismissed().subscribe((action) => {
        this._sheetOpen = false;

        switch (action) {
          case 'delete':
            this.dashboard.deleteWidget(this.widgetProperties.uuid);
            break;
          default:
            break;
        }
      });
    }
  }
}
