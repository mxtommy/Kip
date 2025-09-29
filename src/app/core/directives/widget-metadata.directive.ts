import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../services/data.service';
import { ISkZone } from '../interfaces/signalk-interfaces';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { WidgetRuntimeDirective } from './widget-runtime.directive';

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
   * Optional config input for standalone usage (non-Host2 widgets).
   * Host2 widgets should rely on WidgetRuntimeDirective instead.
   *
   * @example
   * ```html
   * <div widget-metadata [metaConfig]="widgetConfig">
   * ```
   */
  public metaConfig = input<IWidgetSvcConfig>();
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
  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private reset$ = new Subject<void>();
  private lastKey: string | undefined;
  private currentSub: Subscription | undefined;
  private pathSignature: string | undefined;

  /**
   * Begin observing metadata for the specified path key.
   *
   * Behavior:
   * - If pathKey is provided, observes that specific path from config.paths
   * - If pathKey is omitted, observes the first configured path
   * - Idempotent: calling with same path multiple times won't create duplicate subscriptions
   * - Previous subscription is cleanly replaced when path changes
   * - {@link zones} signal is updated reactively as metadata changes. Widgets can use this
   * signal in computed/effects to react to zone updates.
   *
   * Best Practices:
   * - Call once per path in widget ngOnInit or constructor effect
   * - Use with config paths that have zones metadata (typically numeric gauge paths)
   * - No manual cleanup needed; directive handles subscription lifecycle
   *
   * @param pathKey Optional path key from config.paths. If omitted, uses first available path.
   *
   * @example
   * ```typescript
   * // Single path observation (most common)
   * constructor() {
   *   // Observe default path (first in config.paths)
   *   this.metadata.observe();
   *
   *   // Or observe specific path
   *   this.metadata.observe('primaryPath');
   * }
   * ```
   */
  public observe(pathKey?: string): void {
    const cfg = this.runtime?.options() ?? this._metaConfig() ?? this.metaConfig();
    if (!cfg?.paths || Object.keys(cfg.paths).length === 0) return;
    const key = pathKey || Object.keys(cfg.paths)[0];
    this.lastKey = key;
    const path = cfg.paths[key]?.path;
    if (!path) return;
    const sig = path; // simple signature (only path matters for zones)
    if (this.pathSignature === sig) return; // unchanged
    this.subscribePathMeta(path, sig);
  }

  private subscribePathMeta(path: string, sig: string): void {
    // Tear down existing if different
    if (this.currentSub) {
      this.currentSub.unsubscribe();
      this.currentSub = undefined;
    }
    this.pathSignature = sig;
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
   * Apply config changes with diff-based subscription management.
   * Called automatically by Host2 when widget config is updated.
   * Only resubscribes if the primary path actually changed.
   *
   * Behavior:
   * - Compares new path signature against current subscription
   * - Reuses existing subscription if path unchanged (performance optimization)
   * - Cleanly tears down and rebuilds subscription when path changes
   * - Resets zones to empty array if no valid paths in new config
   *
   * @param cfg New widget config or undefined to clear all subscriptions
   * @internal
   */
  public applyMetaConfigDiff(cfg: IWidgetSvcConfig | undefined): void {
    this._metaConfig.set(cfg);
    if (!cfg?.paths || Object.keys(cfg.paths).length === 0) {
      this.reset();
      return;
    }
    const key = this.lastKey && cfg.paths[this.lastKey] ? this.lastKey : Object.keys(cfg.paths)[0];
    const newPath = cfg.paths[key]?.path;
    const newSig = newPath ?? '';
    if (!newPath) {
      this.reset();
      return;
    }
    if (this.pathSignature === newSig) return; // unchanged
    this.subscribePathMeta(newPath, newSig);
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
