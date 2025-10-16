import { Directive, DestroyRef, inject, signal } from '@angular/core';
import { DataService, IPathUpdate } from '../services/data.service';
import { UnitsService } from '../services/units.service';
import { IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { Observable, Observer, Subject, delayWhen, map, retryWhen, sampleTime, tap, throwError, timeout, timer, takeUntil, take, merge, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Directive({
  selector: '[widget-streams]',
  exportAs: 'widgetStreams'
})
/**
 * Streams directive manages live data subscriptions for widget Signal K paths.
 *
 * Architecture:
 * - Each widget instance gets its own directive instance (no cross-widget sharing)
 * - One callback per path (subsequent observe() calls replace previous callback)
 * - Per-path base observable cache to avoid redundant DataService subscriptions
 * - Diff-based updates: only rebuilds subscriptions when path signatures change
 *
 * Key Features:
 * - Fast first emission (take(1)) merged with sampled stream for immediate render
 * - Automatic unit conversion for numeric paths via UnitsService
 * - Optional timeout + retry handling (enableTimeout, dataTimeout config)
 * - Path validation: null/undefined/empty paths trigger cleanup
 * - Signature tracking: path + pathType + sampleTime + convertUnitTo + source
 *
 * Usage Pattern:
 * - Call observe(pathKey, callback) once per required path
 * - Multiple paths require multiple observe() calls
 * - Config changes automatically trigger diff-based subscription updates
 * - All subscriptions auto-cleanup on directive destroy
 */
export class WidgetStreamsDirective {
  private _streamsConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  private readonly dataService = inject(DataService);
  private readonly unitsService = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  // Base raw observables per logical path key
  private streams: Map<string, Observable<IPathUpdate>> | undefined;
  private registrations: { pathName: string; next: (value: IPathUpdate) => void }[] = [];
  // Active subscriptions per path (so we can surgically unsubscribe changed/removed paths)
  private subscriptions = new Map<string, { sub: Subscription; signature: string }>();
  // Track identity of the cached base observable (path + normalized source) per path key
  private baseSignatures = new Map<string, string>();
  // Root-level signature (timeout settings) to detect when all paths need pipeline rebuild
  private reset$ = new Subject<void>();
  private rootSignature: string | undefined;

  /** Build a simple Observer wrapper for a given path key. */
  private buildObserver(pathKey: string, next: ((value: IPathUpdate) => void)): Observer<IPathUpdate> {
    return {
      next: v => next(v),
      error: err => console.error('[Widget] Observer got an error: ' + err),
      complete: () => { }
    };
  }

  private computePathSignature(pathCfg: { path: string; pathType: string; sampleTime?: number; convertUnitTo?: string; source?: string }): string {
    const normalizedPath = this.normalizePath(pathCfg.path) ?? '';
    const src = (pathCfg.source?.trim() || 'default');
    return [normalizedPath, pathCfg.pathType, pathCfg.sampleTime, pathCfg.convertUnitTo, src].join('|');
  }

  private computeBaseKey(path: string, source?: string): string {
    const normalizedPath = this.normalizePath(path) ?? '';
    const src = (source?.trim() || 'default');
    return `${normalizedPath}|${src}`;
  }

  private normalizePath(path: unknown): string | undefined {
    if (typeof path !== 'string') return undefined;
    const trimmed = path.trim();
    return trimmed.length ? trimmed : undefined;
  }

  private computeRootSignature(cfg: IWidgetSvcConfig | undefined): string {
    if (!cfg) return 'none';
    return `timeout:${cfg.enableTimeout ? '1' : '0'}:${cfg.dataTimeout ?? ''}`;
  }

  private ensureStreamsMap(): void {
    if (!this.streams) this.streams = new Map<string, Observable<IPathUpdate>>();
  }

  /** Create (or reuse) base observable, assemble pipeline, and subscribe with diff-aware replacement. */
  private buildAndSubscribe(pathName: string, next: (value: IPathUpdate) => void, cfg: IWidgetSvcConfig, pathCfg: { path: string; pathType: string; sampleTime?: number; convertUnitTo?: string; source?: string }): void {
    const normalizedPath = this.normalizePath(pathCfg.path);
    if (!normalizedPath) {
      const existing = this.subscriptions.get(pathName);
      if (existing) existing.sub.unsubscribe();
      this.subscriptions.delete(pathName);
      this.streams?.delete(pathName);
      this.baseSignatures.delete(pathName);
      return;
    }

    // Build base observable if missing, or refresh when path/source changed
    this.ensureStreamsMap();
    const baseKey = this.computeBaseKey(normalizedPath, pathCfg.source);
    const currentBaseKey = this.baseSignatures.get(pathName);
    if (!this.streams!.has(pathName) || currentBaseKey !== baseKey) {
      this.streams!.set(pathName, this.dataService.subscribePath(normalizedPath, pathCfg.source?.trim() || 'default'));
      this.baseSignatures.set(pathName, baseKey);
    }
    const base$ = this.streams!.get(pathName)!;

    const enableTimeout = !!cfg.enableTimeout;
    const dataTimeout = (cfg.dataTimeout ?? 5) * 1000;
    const retryDelay = 5000;
    const timeoutErrorMsg = `[Widget] ${cfg.displayName} - ${dataTimeout / 1000} second data update timeout reached for `;
    const retryErrorMsg = `[Widget] ${cfg.displayName} - Retrying in ${retryDelay / 1000} seconds`;

    const pathType = pathCfg.pathType;
    const convert = pathCfg.convertUnitTo;
    let sample = Number(pathCfg.sampleTime);
    if (!Number.isFinite(sample) || sample <= 0) sample = 1000;
    const toUnit = (val: number) => convert ? this.unitsService.convertToUnit(convert, val) : val;

    let data$: Observable<IPathUpdate> = base$;
    if (pathType === 'number') {
      data$ = data$.pipe(
        map(x => ({ data: { value: toUnit(x.data.value as number), timestamp: x.data.timestamp }, state: x.state } as IPathUpdate))
      );
    }
    const initial$ = data$.pipe(take(1));
    const sampled$ = data$.pipe(sampleTime(sample));
    data$ = merge(initial$, sampled$);
    if (enableTimeout) {
      data$ = data$.pipe(
        timeout({
          each: dataTimeout,
          with: () => throwError(() => {
            console.log(timeoutErrorMsg + normalizedPath);
            this.dataService.timeoutPathObservable(normalizedPath, pathType);
          })
        }),
        retryWhen(error => error.pipe(
          tap(() => console.log(retryErrorMsg)),
          delayWhen(() => timer(retryDelay))
        ))
      );
    }
    const observer = this.buildObserver(pathName, next);
    const sub = data$
      .pipe(
        takeUntil(this.reset$),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(observer);
    const normalizedCfg = { ...pathCfg, path: normalizedPath };
    const signature = this.computePathSignature(normalizedCfg);
    // Replace any existing subscription
    const existing = this.subscriptions.get(pathName);
    if (existing) existing.sub.unsubscribe();
    this.subscriptions.set(pathName, { sub, signature });
  }

  /**
   * Programmatically set widget configuration for the streams directive.
   *
   * This is a manual config injection mechanism primarily used when widgets are
   * embedded and require hardcoded or parent component configuration management.
   *
   * Behavior:
   * - Updates internal config signal immediately
   * - Does NOT trigger automatic subscription updates (unlike applyStreamsConfigDiff)
   * - Widgets must call observe() after setStreamsConfig() to establish subscriptions
   * - Useful for runtime config injection without Host2 dependency
   *
   * Usage Patterns:
   * ```ts
   * // Embedded widget scenario
   * const streams = inject(WidgetStreamsDirective);
   * streams.setStreamsConfig(myWidgetConfig);
   * streams.observe('primaryPath', data => this.handleData(data));
   *
   * // Dynamic config updates
   * streams.setStreamsConfig(newConfig);
   * streams.observe('newPath', callback); // Creates subscription with new config
   * ```
   *
   * Note: For regular widgets, use WidgetRuntimeDirective which automatically
   * handles stream lifecycle management and config changes.
   *
   * @param cfg Widget service config or undefined to clear configuration
   * @public For manual config injection in embedded/hardcoded contexts such the
   * Widget-autopilot widget in route mode.
   */
  public setStreamsConfig(cfg: IWidgetSvcConfig | undefined) {
    this._streamsConfig.set(cfg);
    // Initialize root signature so first applyStreamsConfigDiff doesn't treat it as changed
    this.rootSignature = this.computeRootSignature(cfg);
  }

  /**
   * Apply config changes with diff-based subscription management.
   * Called automatically by Host2 when widget config updates.
   *
   * Behavior:
   * - Compares path signatures (path + pathType + sampleTime + convertUnitTo + source)
   * - Compares root signature (timeout settings: enableTimeout + dataTimeout)
   * - Only rebuilds subscriptions for paths with changed signatures
   * - Removes subscriptions for deleted paths
   * - Preserves unchanged subscriptions for performance
   * - Cleans up invalid paths (null/undefined/empty)
   * - Defers subscription creation until observe() is called if no registrations exist
   *
   * Performance: Avoids unnecessary subscription churn during config edits
   *
   * @param cfg New widget config or undefined to clear all subscriptions
   * @internal Used by Host2 runtime - widgets should not call directly
   */
  public applyStreamsConfigDiff(cfg: IWidgetSvcConfig | undefined): void {
    const prevCfg = this._streamsConfig();
    const prevRootSig = this.rootSignature;
    const newRootSig = this.computeRootSignature(cfg);
    this._streamsConfig.set(cfg);
    this.rootSignature = newRootSig;

    // If no previous config just exit (widget view will call observe and build on demand)
    if (!prevCfg || !prevCfg.paths || !Object.keys(prevCfg.paths).length) return;
    if (!cfg || !cfg.paths) {
      // All removed
      this.subscriptions.forEach(s => s.sub.unsubscribe());
      this.subscriptions.clear();
      this.streams = undefined;
      this.baseSignatures.clear();
      this.registrations = [];
      return;
    }
    const oldPaths = Object.keys(prevCfg.paths);
    const newPaths = Object.keys(cfg.paths);
    const removed = oldPaths.filter(p => !newPaths.includes(p));
    for (const r of removed) {
      const existing = this.subscriptions.get(r);
      if (existing) existing.sub.unsubscribe();
      this.subscriptions.delete(r);
      this.streams?.delete(r);
      this.baseSignatures.delete(r);
      this.registrations = this.registrations.filter(x => x.pathName !== r);
    }
    const rootChanged = prevRootSig !== newRootSig;
    for (const p of newPaths) {
      const pathCfg = cfg.paths[p];
      const normalizedPath = this.normalizePath(pathCfg?.path);
      if (!normalizedPath) {
        const existing = this.subscriptions.get(p);
        if (existing) existing.sub.unsubscribe();
        this.subscriptions.delete(p);
        this.streams?.delete(p);
        this.baseSignatures.delete(p);
        continue;
      }
      const normalizedCfg = { ...pathCfg, path: normalizedPath };
      const sig = this.computePathSignature(normalizedCfg);
      const existing = this.subscriptions.get(p);
      if (!existing || existing.signature !== sig || rootChanged) {
        // Replace existing subscription if present; otherwise wait for observe()
        if (existing) {
          existing.sub.unsubscribe();
          this.subscriptions.delete(p);
        }
        // Defer base observable creation/refresh to buildAndSubscribe(), which
        // will reuse the cached base when base identity (path+source) is unchanged.
        const reg = this.registrations.find(r => r.pathName === p);
        if (reg) this.buildAndSubscribe(p, reg.next, cfg, normalizedCfg);
      }
    }
  }

  /**
   * Register (idempotent) a consumer callback for a logical path key.
   *
   * DESIGN: Each widget instance gets its own directive instance. Only ONE callback
   * per path is supported - multiple calls with different callbacks will replace
   * the previous one. This simplifies subscription management and avoids callback
   * multiplexing complexity.
   *
   * Behavior:
   * - First call for a path builds subscription pipeline
   * - Subsequent calls with same callback are no-op (idempotent)
   * - Different callback for same path replaces the previous registration
   * - Invalid paths (null/empty) clear any existing subscription
   * - Pipeline rebuilds automatically when path config signature changes. Signature is made of: path, pathType, source, sampleTime, convertUnitTo
   *
   * Lifecycle / Cleanup:
   * - Subscriptions auto-cleanup on directive destroy
   * - Config changes trigger diff-based subscription signature tracking
   * - Invalid paths immediately cleanup resources
   *
   * Best Practices:
   * 1. Call once per required path key in component initialization
   * 2. Keep callback stable (avoid recreating functions) to prevent unnecessary rebuilds
   * 3. Delegate heavy processing to signals/computed - keep callback lightweight
   * 4. No manual cleanup needed - directive handles lifecycle
   *
   * Examples:
   * ```ts
   * // Single path numeric widget
   * this.streams.observe('speed', update => {
   *   this.speed.set(update.data.value as number); // Auto unit-converted
   * });
   *
   * // Multiple paths - call observe() once per path
   * this.streams.observe('windSpeed', update => this.windSpeed.set(update.data.value));
   * this.streams.observe('windAngle', update => this.windAngle.set(update.data.value));
   * this.streams.observe('boatSpeed', update => {
   *   let myValue: number;
   *   // custom processing
   *   this.boatSpeed.set(myValue);
   * });
   * ```
   *
   * @param pathName Logical path key from widget config (config.paths[pathName])
   * @param next Callback for processed updates (unit conversion + sampling applied)
   */
  public observe(pathName: string, next: (value: IPathUpdate) => void): void {
    // Capture previous callback before replacing registration
    const prevReg = this.registrations.find(r => r.pathName === pathName)?.next;
    // Replace any existing registration for this path (one callback per path)
    this.registrations = this.registrations.filter(r => r.pathName !== pathName);
    this.registrations.push({ pathName, next });

    const cfg = this._streamsConfig();
    if (!cfg || !cfg.paths?.[pathName]) {
      // Config missing - cleanup existing subscription but keep registration for later
      const existing = this.subscriptions.get(pathName);
      if (existing) {
        existing.sub.unsubscribe();
        this.subscriptions.delete(pathName);
        this.streams?.delete(pathName);
        this.baseSignatures.delete(pathName);
      }
      return;
    }

    const pathCfg = cfg.paths[pathName];
    const normalizedPath = this.normalizePath(pathCfg?.path);
    if (!normalizedPath) {
      // Invalid path - cleanup subscription and remove registration
      const existing = this.subscriptions.get(pathName);
      if (existing) {
        existing.sub.unsubscribe();
        this.subscriptions.delete(pathName);
        this.streams?.delete(pathName);
        this.baseSignatures.delete(pathName);
      }
      this.registrations = this.registrations.filter(r => r.pathName !== pathName);
      return;
    }

    const normalizedCfg = { ...pathCfg, path: normalizedPath };
    const sig = this.computePathSignature(normalizedCfg);
    const existing = this.subscriptions.get(pathName);
    // If signature unchanged but callback changed, rebuild to swap observer; otherwise keep
    if (existing && existing.signature === sig && prevReg === next) return;

    this.buildAndSubscribe(pathName, next, cfg, normalizedCfg);
  }
}
