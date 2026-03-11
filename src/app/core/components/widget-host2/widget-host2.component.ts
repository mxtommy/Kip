import { Component, inject, Type, ViewChild, ViewContainerRef, Input, effect, ComponentRef, OnDestroy, OnInit, untracked, ChangeDetectionStrategy, inputBinding } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { TwoFingerTapDirective } from '../../directives/two-finger-tap.directive';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IWidget, IWidgetPath, IWidgetSvcConfig } from '../../interfaces/widgets-interface';
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
import { DashboardHistorySeriesSyncService } from '../../services/dashboard-history-series-sync.service';
import { IKipSeriesDefinition, KipSeriesApiClientService } from '../../services/kip-series-api-client.service';
import { isKipSeriesEnabled, isKipTemplateSeriesDefinition } from '../../contracts/kip-series-contract';
import cloneDeep from 'lodash-es/cloneDeep';
import { SettingsService } from '../../services/settings.service';
import { uiEventService } from '../../services/uiEvent.service';

// Base shape expected from view components (optional defaultConfig)
// NOTE: Widgets should expose a static DEFAULT_CONFIG to avoid temporary instantiation.
// If absent, Host2 will create & immediately destroy a temp instance to read instance.defaultConfig.
interface WidgetViewComponentBase { defaultConfig?: IWidgetSvcConfig }

type TOverlayGate = 'history' | 'options' | 'sheet';

@Component({
  selector: 'widget-host2',
  imports: [MatCardModule, MatBottomSheetModule, GestureDirective, TwoFingerTapDirective],
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
export class WidgetHost2Component extends BaseWidget implements OnInit, OnDestroy {
  // Gridstack supplies a single widgetProperties object - does NOT support input signal yet
  @Input({ required: true }) protected widgetProperties!: IWidget;
  @ViewChild('childOutlet', { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;
  private readonly dialog = inject(DialogService);
  protected readonly dashboard = inject(DashboardService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly streams = inject(WidgetStreamsDirective, { optional: true });
  private readonly meta = inject(WidgetMetadataDirective, { optional: true });
  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly widgetService = inject(WidgetService);
  private readonly app = inject(AppService);
  private readonly historySync = inject(DashboardHistorySeriesSyncService);
  private readonly kipSeries = inject(KipSeriesApiClientService);
  private readonly _uiEvent = inject(uiEventService);

  private readonly settings = inject(SettingsService);

  protected theme = toSignal(this.app.cssThemeColorRoles$, { requireSync: true });
  private childRef: ComponentRef<WidgetViewComponentBase> | null = null;
  private compType: Type<WidgetViewComponentBase>
  private _hasInitialized = false;
  private readonly openOverlays = new Set<TOverlayGate>();
  // Debug helper gated by the same localStorage flag used by gestures directive
  private isDebugEnabled(): boolean {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem('kip:gesturesDebug') === '1'; } catch { return false; }
  }
  private debug(...args: unknown[]) { if (this.isDebugEnabled()) console.debug('[Host2]', ...args); }

  private acquireOverlay(kind: TOverlayGate): boolean {
    if (this.openOverlays.has(kind)) {
      this.debug(`${kind} already open; ignoring`, { widgetId: this.widgetProperties?.uuid });
      return false;
    }

    this.openOverlays.add(kind);
    return true;
  }

  private releaseOverlay(kind: TOverlayGate): void {
    this.openOverlays.delete(kind);
  }

  constructor() {
    super();

    // React to dashboard cancel events: restore saved config without destroying the widget
    effect(() => {
      const tick = this.dashboard.layoutEditCanceled();
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
    this.compType = this.widgetService.getComponentType(type) as Type<WidgetViewComponentBase> | undefined;

    // Resolve default configuration for this component type using helper
    const defaultCfg = this.getDefaultConfig();

    // Initialize runtime with merged config prior to creating the visual component so streams/meta can bind early.
    this.runtime?.initialize?.(defaultCfg, this.widgetProperties.config);
    const merged = this.runtime?.options();
    if (merged) this.widgetProperties.config = merged;
    // Initial diff-based streams wiring (registrations occur when child calls observe)
    this.streams?.applyStreamsConfigDiff?.(merged);
    this.meta?.applyMetaConfigDiff?.(merged);

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

  ngOnDestroy(): void {
    this.childRef?.destroy();
    this.childRef = null;
    this.openOverlays.clear();
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
   * Apply a new user-edited config (e.g., from options dialog):
   * - Updates runtime merged options
   * - Triggers diff-based reconfiguration for streams & metadata
   * @param cfg New user configuration fragment (already validated) or undefined to re-emit existing.
   */
  private applyRuntimeConfig(cfg?: IWidgetSvcConfig): void {
    if (cfg) {
      this.runtime?.setRuntimeConfig?.(cfg);
    }
    const runtimeCfg = this.runtime?.options();
    if (runtimeCfg) {
      this.widgetProperties.config = runtimeCfg;
    }

    this.streams?.applyStreamsConfigDiff?.(runtimeCfg);
    this.meta?.applyMetaConfigDiff?.(runtimeCfg);
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
      this.runtime?.initialize?.(defaultCfg, cloneDeep(saved));
      const merged = this.runtime?.options();
      if (merged) this.widgetProperties.config = merged;
      this.streams?.applyStreamsConfigDiff?.(merged);
      this.meta?.applyMetaConfigDiff?.(merged);
      // console.debug('[Host2] cancel revert applied', this.widgetProperties.uuid, { found: !!saved });
    } catch (error) {
      console.error('[Host2] failed to reinitialize saved config', {
        widgetId: this.widgetProperties?.uuid,
        error
      });
    }
  }

  /**
   * Lookup the saved configuration for this widget from the active dashboard.
   * Prefers Angular Gridstack input mapping; falls back to any legacy shape.
   */
  private getSavedConfigForSelf(): IWidgetSvcConfig | undefined {
    try {
      const dashboards = this.dashboard.dashboards();
      const activeIdx = this.dashboard.activeDashboard();
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
   * @returns void
   * @example
   * this.openWidgetOptions(event);
   */
  public openWidgetOptions(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    this.debug('openWidgetOptions invoked', { widgetId: this.widgetProperties?.uuid, static: this.dashboard.isDashboardStatic() });
    if (!this.dashboard.isDashboardStatic()) {
      if (!this.acquireOverlay('options')) {
        return;
      }
      if (!this.widgetProperties) {
        this.releaseOverlay('options');
        return;
      }

      try {
        this.dialog.openWidgetOptions({
          title: 'Widget Options',
          config: this.widgetProperties.config,
          confirmBtnText: 'Save',
          cancelBtnText: 'Cancel'
        }).afterClosed().subscribe(result => {
          this.releaseOverlay('options');
          if (result) {
            this.debug('options saved', { widgetId: this.widgetProperties?.uuid });
            this.applyRuntimeConfig(result);
          }
        });
      } catch (error) {
        this.releaseOverlay('options');
        console.error('[Host2] failed to open widget options', {
          widgetId: this.widgetProperties?.uuid,
          error
        });
      }
    }
  }

  /**
   * Open the bottom sheet for widget management (delete / duplicate actions).
   * @param e Event used to stop propagation.
   * @returns void
   * @example
   * this.openBottomSheet(event);
   */
  public openBottomSheet(e: Event | CustomEvent): void {
    (e as Event).stopPropagation();
    this.debug('openBottomSheet invoked', { widgetId: this.widgetProperties?.uuid, static: this.dashboard.isDashboardStatic() });
    if (!this.dashboard.isDashboardStatic()) {
      if (this._uiEvent.isDragging()) {
        this.debug('bottom sheet suppressed during drag', { widgetId: this.widgetProperties?.uuid });
        return;
      }
      if (!this.acquireOverlay('sheet')) {
        return;
      }
      const isLinuxFirefox = typeof navigator !== 'undefined' &&
        /Linux/.test(navigator.platform) &&
        /Firefox/.test(navigator.userAgent);

      try {
        const sheetRef = this.bottomSheet.open(WidgetHostBottomSheetComponent, isLinuxFirefox ? { disableClose: true, data: { showCancel: true } } : {});
        sheetRef.afterDismissed().subscribe((action) => {
          this.releaseOverlay('sheet');
          this.debug('bottom sheet dismissed', { widgetId: this.widgetProperties?.uuid, action });
          switch (action) {
            case 'delete':
              this.dashboard.deleteWidget(this.widgetProperties.uuid);
              break;
            case 'duplicate':
              this.dashboard.duplicateWidget(this.widgetProperties.uuid);
              break;
            case 'copy':
              this.dashboard.copyWidget(this.widgetProperties.uuid);
              break;
            case 'cut':
              this.dashboard.cutWidget(this.widgetProperties.uuid);
              break;
            default:
              break;
          }
        });
      } catch (error) {
        this.releaseOverlay('sheet');
        console.error('[Host2] failed to open bottom sheet', {
          widgetId: this.widgetProperties?.uuid,
          error
        });
      }
    }
  }

  /**
   * Opens the locked-mode history chart dialog using the widget's resolved historical series.
   *
   * @param {MouseEvent} event Browser context menu event.
   * @returns {void}
   *
   * @example
   * this.openWidgetHistoryDialog(event);
   */
  public openWidgetHistoryDialog(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    void this.openWidgetHistoryDialogInternal();
  }

  /**
   * Handles a two-finger tap gesture and opens the locked-mode history dialog.
   *
   * @param event Pointer event emitted by TwoFingerTapDirective.
   * @returns void
   *
   * @example
   * this.onHistoryTwoFingerTap(event);
   */
  public onHistoryTwoFingerTap(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    void this.openWidgetHistoryDialogInternal();
  }

  private async openWidgetHistoryDialogInternal(): Promise<void> {

    if (this.settings.getWidgetHistoryDisabled()) {
      return;
    }

    if (!this.dashboard.isDashboardStatic()) {
      return;
    }

    if (!this.acquireOverlay('history')) {
      return;
    }

    try {
      const seriesDefinitions = await this.resolveEffectiveSeriesDefinitions();
      if (!this.isHistoryDialogEligible(this.widgetProperties, seriesDefinitions)) {
        this.releaseOverlay('history');
        return;
      }

      const title = this.widgetProperties?.config?.displayName || (this.widgetProperties?.type === 'widget-bms' ? 'Battery Monitor' : 'Widget History');

      this.dialog.openWidgetHistoryDialog({
        title,
        widget: this.widgetProperties,
        seriesDefinitions
      }).afterClosed().subscribe(() => {
        this.releaseOverlay('history');
      });
    } catch (error) {
      this.releaseOverlay('history');
      console.error('[Host2] failed to open history dialog', {
        widgetId: this.widgetProperties?.uuid,
        error
      });
    }
  }

  private async resolveEffectiveSeriesDefinitions(): Promise<IKipSeriesDefinition[]> {
    const resolved = this.historySync.resolveSeriesForWidget(this.widgetProperties);
    const hasTemplateSeries = resolved.some(isKipTemplateSeriesDefinition);

    if (!hasTemplateSeries) {
      return resolved;
    }

    const effective = await this.kipSeries.getSeriesDefinitions();
    if (!effective) {
      return resolved;
    }

    const widgetUuid = this.widgetProperties?.uuid;
    if (!widgetUuid) {
      return resolved;
    }

    const bmsMetricPaths = new Set(['electrical.batteries', 'self.electrical.batteries']);

    return effective.filter(series => {
      if (series.ownerWidgetUuid !== widgetUuid || !isKipSeriesEnabled(series)) {
        return false;
      }

      const path = (series.path ?? '').trim();
      if (!path.length) {
        return false;
      }

      return Array.from(bmsMetricPaths).some(prefix => path.startsWith(`${prefix}.`));
    });
  }

  private isHistoryDialogEligible(widget: IWidget | null | undefined, seriesDefinitions: { path?: string | null; enabled?: boolean; expansionMode?: string | null }[]): boolean {
    if (!widget?.config || widget.config.supportAutomaticHistoricalSeries === false) {
      return false;
    }

    if (widget.type === 'widget-bms') {
      return seriesDefinitions.some(series => series.enabled === true);
    }

    const numericPaths = this.extractNumericPaths(widget.config.paths);
    if (!numericPaths.length) {
      return false;
    }

    return seriesDefinitions.some(series => {
      const path = typeof series.path === 'string' ? series.path.trim() : '';
      const hasMatchingNumericPath = numericPaths.includes(path);
      if (!hasMatchingNumericPath) {
        return false;
      }

      return series.enabled === true;
    });
  }

  private extractNumericPaths(paths: IWidgetSvcConfig['paths'] | undefined): string[] {
    if (!paths) {
      return [];
    }

    const entries: IWidgetPath[] = Array.isArray(paths) ? paths : Object.values(paths);
    const uniquePaths = new Set<string>();

    entries.forEach(pathCfg => {
      if (pathCfg?.pathType !== 'number') {
        return;
      }

      const path = typeof pathCfg.path === 'string' ? pathCfg.path.trim() : '';
      if (path.length) {
        uniquePaths.add(path);
      }
    });

    return [...uniquePaths];
  }
}
