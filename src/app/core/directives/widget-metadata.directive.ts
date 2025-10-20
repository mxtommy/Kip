import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../services/data.service';
import { ISkZone } from '../interfaces/signalk-interfaces';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Directive({
  selector: '[widget-metadata]',
  exportAs: 'widgetMetadata'
})
/**
 * Metadata directive subscribes to Signal K zones metadata for widget paths.
 * Optimized for single-path usage but supports multi-path configs.
 *
 * Key Features:
 * - Provides reactive zones signal that updates when metadata changes
 * - Diff-based subscription management (only resubscribes when path changes)
 * - Integrates with WidgetRuntimeDirective for automatic config updates
 * - Supports both Host2 (runtime-driven) and standalone usage patterns
 *
 * Lifecycle:
 * - Call `observe(pathKey?)` to start metadata subscription for a specific path
 * - `applyMetaConfigDiff()` is called by Host2 when config changes (automatic)
 * - Subscriptions are automatically cleaned up on directive destroy
 *
 * Usage Patterns:
 * 1. Host2 widgets: Inject directive, call `observe()` once, read `zones()` signal
 * 2. Multi-path: Call `observe(pathKey)` for each path requiring zones
 */
export class WidgetMetadataDirective {
  /**
   * Reactive signal containing current zones metadata for the observed path.
   * Emits empty array when no zones are defined or path has no metadata.
   *
   * Consumer widgets should use this in computed signals or effects in
   * combination with getHighlights(cfg, zones) utility to derive highlights:
   *
   * @example
   * ```typescript
   * // Import Highlights utility
   * import { getHighlights } from '../../core/utils/zones-highlight.utils';
   *
   * // In widget component
   * highlights = computed(() => {
   *   const cfg = this.runtime.options();
   *   const theme = this.theme();
   *   const zones = this.metadata.zones();
   *   if (!cfg || !theme) return [];
   *   if (cfg.ignoreZones || !this.metadata) return [];
   *   if (!zones?.length) return [];
   *
   *   const unit = cfg.paths['gaugePath'].convertUnitTo;
   *   const min = cfg.displayScale.lower;
   *   const max = cfg.displayScale.upper;
   *   return getHighlights(zones, theme, unit, this.unitsService, min, max);
   * });
   * ```
   */
  public zones = signal<ISkZone[]>([]);
  /**
   * Optional widget input for standalone usage.
   * Typically not needed since config contains all path information.
   *
   * @example
   * ```html
   * <div widget-metadata [metaWidget]="widgetInstance">
   * ```
   */
  public metaWidget = input<IWidget>();

  private _metaConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private reset$ = new Subject<void>();
  private currentSub: Subscription | undefined;
  private pathSignature: string | undefined;

  /**
   * Begin observing metadata for a path and own the signature gating.
   *
   * Responsibilities:
   * - Sole authority for path resolution and signature comparison
   * - Resolves the effective key: `pathKey` if provided and valid, otherwise the first key in `cfg.paths`
   * - Computes the signature from the resolved path (currently the path string itself)
   * - Idempotent: if the computed signature matches `pathSignature`, this is a no-op
   * - On change: stores `pathSignature` and calls {@link subscribePathMeta} to (re)subscribe
   *
   * Notes:
   * - This method intentionally centralizes all signature logic; downstream helpers do not manage signatures
   * - If config has no valid paths or the resolved path is empty, it safely no-ops
   *
   * @param pathKey Optional path key from config.paths. If omitted, the first available path is used.
   *
   * @example
   * ```typescript
   * // Typical single-path usage
   * this.metadata.observe(); // uses first configured path
   * // Or explicitly select a path key
   * this.metadata.observe('gaugePath');
   * ```
   */
  public observe(pathKey?: string): void {
    const cfg = this._metaConfig();
    if (!cfg?.paths || Object.keys(cfg.paths).length === 0) return;
    const key = pathKey ?? Object.keys(cfg.paths)[0];
    const path = cfg.paths[key]?.path;
    if (!path) return;

    // Signature gating handled here (path alone defines zones signature)
    const sig = path;
    if (this.pathSignature === sig) return; // unchanged

    // Update signature and (re)subscribe
    this.pathSignature = sig;
    this.subscribePathMeta(path);
  }

  /**
   * Subscribe to Signal K path metadata and update {@link zones}.
   *
   * Responsibilities:
   * - Tear down any existing metadata subscription
   * - Subscribe to `DataService.getPathMetaObservable(path)` and write to {@link zones}
   * - Handle lifecycle cleanup via `takeUntil(this.reset$)` and `takeUntilDestroyed(this.destroyRef)`
   *
   * Important:
   * - This method does NOT set or compare signatures; that is owned by {@link observe}
   * - Callers must ensure signature gating before invoking this method
   */
  private subscribePathMeta(path: string): void {
    // Tear down existing if different
    if (this.currentSub) {
      this.currentSub.unsubscribe();
      this.currentSub = undefined;
    }
    const sub = this.dataService.getPathMetaObservable(path)
      .pipe(
        takeUntil(this.reset$),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(meta => {
        if (!meta) {
          this.zones.set([]);
        } else if (meta.zones) {
          this.zones.set([...meta.zones]);
        } else {
          this.zones.set([]);
        }
      });
    this.currentSub = sub;
  }

  /**
   * Programmatically set config for Host2 usage.
   * Called internally by Host2; widget authors should not call this directly.
   *
   * @param cfg Widget service config or undefined to clear
   * @internal
   */
  public setMetaConfig(cfg: IWidgetSvcConfig | undefined): void {
    this._metaConfig.set(cfg);
  }

  /**
   * Apply config changes (store-only) and optionally reconcile observation.
   *
   * Responsibilities:
   * - Store the latest config reference in an internal signal
   * - Do not perform signature math here; defer all gating to {@link observe}
   * - If we are already observing a path (truthy `pathSignature`), call {@link observe}
   *   to reconcile with the new config; otherwise, do nothing (no auto-start)
   *
   * Rationale:
   * - Keeps separation of concerns clear: `observe()` owns (re)subscription and signature logic
   * - Prevents accidental auto-subscription on first-time config arrival
   *
   * @param cfg New widget config or undefined
   * @internal
   */
  public applyMetaConfigDiff(cfg: IWidgetSvcConfig | undefined): void {
    this._metaConfig.set(cfg);
    // If already observing a path (signature present), check re-observe
    if (this.pathSignature) {
      this.observe();
    }
  }

  /**
   * Reset current metadata subscription and clear zones signal.
   * Useful for manual cleanup or when switching between different path sets.
   *
   * @example
   * ```typescript
   * // Manual reset (rarely needed)
   * this.metadata.reset();
   * this.metadata.observe('newPath');
   * ```
   */
  public reset(): void {
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
    if (this.currentSub) {
      this.currentSub.unsubscribe();
      this.currentSub = undefined;
    }
    this.pathSignature = undefined;
    this.zones.set([]);
  }
}
