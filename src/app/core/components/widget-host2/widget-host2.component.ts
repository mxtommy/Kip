import { Component, inject, Type, ViewChild, ViewContainerRef, Input, effect, ComponentRef, OnInit, untracked, ChangeDetectionStrategy, inputBinding } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IWidget, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import type { NgCompInputs, NgGridStackWidget } from 'gridstack/dist/angular';
import { BaseWidget } from 'gridstack/dist/angular';
import { WidgetStreamsDirective } from '../../directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../directives/widget-metadata.directive';
import { WidgetRuntimeDirective } from '../../directives/widget-runtime.directive';
import { DialogService } from '../../services/dialog.service';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';
import { WidgetService } from '../../services/widget.service';
import { AppService } from '../../services/app-service';
import cloneDeep from 'lodash-es/cloneDeep';

// Base shape expected from view components (optional defaultConfig)
// NOTE: Widgets should expose a static DEFAULT_CONFIG to avoid temporary instantiation.
// If absent, Host2 will create & immediately destroy a temp instance to read instance.defaultConfig.
interface WidgetViewComponentBase { defaultConfig?: IWidgetSvcConfig }

@Component({
  selector: 'widget-host2',
  imports: [MatCardModule, MatBottomSheetModule, GestureDirective],
  templateUrl: './widget-host2.component.html',
  styleUrl: './widget-host2.component.scss',
  hostDirectives: [
    { directive: WidgetStreamsDirective },
    { directive: WidgetMetadataDirective },
    { directive: WidgetRuntimeDirective }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})

/**
 * Host2 is the parent component for all dashboard widgets. It's objective
 * is to abstract away the complexities of widget instantiation and management
 * and make widget creation seamless as much as possible.
 *
 * Host2 is responsible for:
 * 1. Discovering the concrete widget view component from `WidgetService`.
 * 2. Obtaining default configuration (prefers static DEFAULT_CONFIG, else ephemeral instance).
 * 3. Initializing runtime directive with (default + saved passed by gridstack)
 *    config BEFORE child creation so streams/metadata directives can diff/attach immediately.
 * 4. Creating the child component and supplying minimal structural inputs.
 * 5. Applying diff-based data & metadata configs (no wholesale resets) via directives.
 * 6. Persisting the merged runtime config during serialize for Gridstack state.
 */
export class WidgetHost2Component extends BaseWidget implements OnInit {
  // Gridstack supplies a single widgetProperties object - does NOT support input signal yet
  @Input({ required: true }) protected widgetProperties!: IWidget;
  @ViewChild('childOutlet', { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;
  private readonly _dialog = inject(DialogService);
  protected readonly _dashboard = inject(DashboardService);
  private readonly _bottomSheet = inject(MatBottomSheet);
  private readonly _streams = inject(WidgetStreamsDirective, { optional: true });
  private readonly _meta = inject(WidgetMetadataDirective, { optional: true });
  private readonly _runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly _widgetService = inject(WidgetService);
  private readonly _app = inject(AppService);
  protected theme = toSignal(this._app.cssThemeColorRoles$, { requireSync: true });
  private childRef: ComponentRef<WidgetViewComponentBase>;
  private compType: Type<WidgetViewComponentBase>
  private _hasInitialized = false;
  private _sheetOpen = false;
  private _optionsOpen = false;
  // Debug helper gated by the same localStorage flag used by gestures directive
  private isDebugEnabled(): boolean {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem('kip:gesturesDebug') === '1'; } catch { return false; }
  }
  private debug(...args: unknown[]) { if (this.isDebugEnabled()) console.debug('[Host2]', ...args); }

  constructor() {
    super();

    // React to dashboard cancel events: restore saved config without destroying the widget
    effect(() => {
      const tick = this._dashboard.layoutEditCanceled();
      // Ignore before init or if no cancel tick yet
      if (!this._hasInitialized || !tick) return;
      untracked(() => {
        this.reinitFromSavedConfig();
      });
    });
  }

  ngOnInit(): void {
    const type = this.widgetProperties.type;
    if (!type) return;
    this.compType = this._widgetService.getComponentType(type) as Type<WidgetViewComponentBase> | undefined;

    // Resolve default configuration for this component type using helper
    const defaultCfg = this.getDefaultConfig();

    // Initialize runtime with merged config prior to creating the visual component so streams/meta can bind early.
    this._runtime?.initialize?.(defaultCfg, this.widgetProperties.config);
    const merged = this._runtime?.options();
    if (merged) this.widgetProperties.config = merged;
    // Initial diff-based streams wiring (registrations occur when child calls observe)
    this._streams?.applyStreamsConfigDiff?.(merged);
    this._meta?.applyMetaConfigDiff?.(merged);

    // Create the child component BEFORE first change detection completes so its
    if (this.outlet && this.compType) {
      this.childRef = this.outlet.createComponent(this.compType, {
        bindings: [
          inputBinding('id', () => this.widgetProperties.uuid),
          inputBinding('type', () => this.widgetProperties.type),
          inputBinding('theme', this.theme)
        ]
      });
    }
    this._hasInitialized = true;
  }

  /**
   * Gridstack persistence hook. Ensures we always write the merged runtime options
   * (default + user) so external dashboard storage stays in sync.
   * Falls back to an empty object to avoid Gridstack serializing `undefined`.
   * @returns Gridstack input mapping containing updated `widgetProperties`.
   */
  public override serialize(): NgCompInputs {
    const merged = this._runtime?.options();
    if (merged) {
      this.widgetProperties.config = merged;
    } else if (!this.widgetProperties.config) {
      // As a final fallback ensure config is at least an empty object to avoid Gridstack persisting undefined
      this.widgetProperties.config = {} as IWidgetSvcConfig;
    }
    return { widgetProperties: this.widgetProperties as IWidget } as NgCompInputs;
  }

  /**
   * Apply a new user-edited config (e.g., from options dialog):
   * - Updates runtime merged options
   * - Triggers diff-based reconfiguration for streams & metadata
   * @param cfg New user configuration fragment (already validated) or undefined to re-emit existing.
   */
  private applyRuntimeConfig(cfg?: IWidgetSvcConfig): void {
    if (cfg) {
      this._runtime?.setRuntimeConfig?.(cfg);
    }
    const runtimeCfg = this._runtime.options();
    if (runtimeCfg) {
      this.widgetProperties.config = runtimeCfg;
    }

    this._streams?.applyStreamsConfigDiff?.(runtimeCfg);
    this._meta?.applyMetaConfigDiff?.(runtimeCfg);
  }

  /**
   * Reinitialize runtime from the dashboard's saved config for this widget.
   * Runs during dashboard cancel flow to restore pre-edit UI state.
   */
  private reinitFromSavedConfig(): void {
    try {
      const saved = this.getSavedConfigForSelf();
      // Resolve defaults for this component type
      const defaultCfg = this.getDefaultConfig();
      this._runtime?.initialize?.(defaultCfg, cloneDeep(saved));
      const merged = this._runtime?.options();
      if (merged) this.widgetProperties.config = merged;
      this._streams?.applyStreamsConfigDiff?.(merged);
      this._meta?.applyMetaConfigDiff?.(merged);
      // console.debug('[Host2] cancel revert applied', this.widgetProperties.uuid, { found: !!saved });
    } catch {
      // no-op
    }
  }

  /**
   * Lookup the saved configuration for this widget from the active dashboard.
   * Prefers Angular Gridstack input mapping; falls back to any legacy shape.
   */
  private getSavedConfigForSelf(): IWidgetSvcConfig | undefined {
    try {
      const dashboards = this._dashboard.dashboards();
      const activeIdx = this._dashboard.activeDashboard();
      const dash = dashboards?.[activeIdx];
      type NodeWithConfig = NgGridStackWidget & {
        input?: { widgetProperties?: { config?: IWidgetSvcConfig } };
        widgetProperties?: { config?: IWidgetSvcConfig };
      };
      const nodes = (dash?.configuration as NgGridStackWidget[] | undefined) ?? [];
      const node = nodes.find(n => n?.id === this.widgetProperties.uuid) as NodeWithConfig | undefined;
      return node?.input?.widgetProperties?.config ?? node?.widgetProperties?.config ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Obtain default configuration for the current component type.
   * Prefers static DEFAULT_CONFIG; falls back to an ephemeral instance if needed.
   */
  private getDefaultConfig(): IWidgetSvcConfig | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let defaultCfg: IWidgetSvcConfig | undefined = this.compType && (this.compType as any).DEFAULT_CONFIG;
    if (!defaultCfg && this.compType && this.outlet) {
      const tempRef = this.outlet.createComponent(this.compType);
      defaultCfg = (tempRef.instance as WidgetViewComponentBase).defaultConfig;
      tempRef.destroy();
    }
    return defaultCfg;
  }

  /**
   * Open the widget options dialog (skips when dashboard is static).
   * @param e Event used to stop propagation (click/context menu/etc.).
   */
  public openWidgetOptions(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    this.debug('openWidgetOptions invoked', { widgetId: this.widgetProperties?.uuid, static: this._dashboard.isDashboardStatic() });
    if (!this._dashboard.isDashboardStatic()) {
      if (this._optionsOpen) { this.debug('options already open; ignoring'); return; }
      this._optionsOpen = true;
      if (!this.widgetProperties) return;
      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: this.widgetProperties.config,
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        this._optionsOpen = false;
        if (result) {
          this.debug('options saved', { widgetId: this.widgetProperties?.uuid });
          this.applyRuntimeConfig(result);
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
    this.debug('openBottomSheet invoked', { widgetId: this.widgetProperties?.uuid, static: this._dashboard.isDashboardStatic() });
    if (!this._dashboard.isDashboardStatic()) {
      if (this._sheetOpen) { this.debug('sheet already open; ignoring'); return; }
      this._sheetOpen = true;
      const isLinuxFirefox = typeof navigator !== 'undefined' &&
        /Linux/.test(navigator.platform) &&
        /Firefox/.test(navigator.userAgent);
      const sheetRef = this._bottomSheet.open(WidgetHostBottomSheetComponent, isLinuxFirefox ? { disableClose: true, data: { showCancel: true } } : {});
      sheetRef.afterDismissed().subscribe((action) => {
        this._sheetOpen = false;
        this.debug('bottom sheet dismissed', { widgetId: this.widgetProperties?.uuid, action });
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
