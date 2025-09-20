import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { DataService, IPathUpdate } from '../services/data.service';
import { UnitsService } from '../services/units.service';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { Observable, Observer, Subject, delayWhen, map, retryWhen, sampleTime, tap, throwError, timeout, timer, takeUntil, take, merge, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WidgetRuntimeDirective } from './widget-runtime.directive';

@Directive({
  selector: '[widget-streams]',
  exportAs: 'widgetStreams'
})
/**
 * Streams directive manages live data subscriptions for widget Signal K paths.
 * Key features:
 * - Per-path base observable cache to avoid redundant DataService subscriptions.
 * - Diffing: `applyStreamsConfigDiff` rebuilds only changed path pipelines (incl. root timeout settings).
 * - Fast first emission (take(1)) merged with sampled stream to minimize initial render latency.
 * - Optional timeout + retry handling driven by widget config (enableTimeout, dataTimeout).
 * - Unit conversion for numeric paths centralized before consumer callback.
 * Consumers (widget view components) call `observe(pathKey, cb)` to register interest.
 */
export class WidgetStreamsDirective {
  streamsConfig = input<IWidgetSvcConfig>();
  streamsWidget = input<IWidget>();

  // Programmatic config/widget owned by Host2
  private _streamsConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  public setStreamsConfig(cfg: IWidgetSvcConfig | undefined) { this._streamsConfig.set(cfg); }

  private readonly dataService = inject(DataService);
  private readonly unitsService = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(WidgetRuntimeDirective);
  // Base raw observables per logical path key
  private streams: Map<string, Observable<IPathUpdate>> | undefined;
  // Active subscriptions per path (so we can surgically unsubscribe changed/removed paths)
  private subscriptions = new Map<string, { sub: Subscription; signature: string }>();
  // Root-level signature (timeout settings) to detect when all paths need pipeline rebuild
  private rootSignature: string | undefined;
  private reset$ = new Subject<void>();
  private registrations: { pathName: string; next: (value: IPathUpdate) => void }[] = [];

  /** Build a simple Observer wrapper for a given path key. */
  buildObserver(pathKey: string, next: ((value: IPathUpdate) => void)): Observer<IPathUpdate> {
    return {
      next: v => next(v),
      error: err => console.error('[Widget] Observer got an error: ' + err),
      complete: () => {}
    };
  }

  private computePathSignature(pathCfg: { path: string; pathType: string; sampleTime?: number; convertUnitTo?: string; source?: string }): string {
    return [pathCfg.path, pathCfg.pathType, pathCfg.sampleTime, pathCfg.convertUnitTo, pathCfg.source || ''].join('|');
  }

  private computeRootSignature(cfg: IWidgetSvcConfig | undefined): string {
    if (!cfg) return 'none';
    return `timeout:${cfg.enableTimeout?'1':'0'}:${cfg.dataTimeout ?? ''}`;
  }

  private ensureStreamsMap(): void {
    if (!this.streams) this.streams = new Map<string, Observable<IPathUpdate>>();
  }

  /** Create (or reuse) base observable, assemble pipeline, and subscribe with diff-aware replacement. */
  private buildAndSubscribe(pathName: string, next: (value: IPathUpdate) => void, cfg: IWidgetSvcConfig, pathCfg: { path: string; pathType: string; sampleTime?: number; convertUnitTo?: string; source?: string }): void {
    // Build base observable if missing
    this.ensureStreamsMap();
    if (!this.streams!.has(pathName)) {
      this.streams!.set(pathName, this.dataService.subscribePath(pathCfg.path, pathCfg.source || 'default'));
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
            console.log(timeoutErrorMsg + pathCfg.path);
            this.dataService.timeoutPathObservable(pathCfg.path, pathType);
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
    const signature = this.computePathSignature(pathCfg);
    // Replace any existing subscription
    const existing = this.subscriptions.get(pathName);
    if (existing) existing.sub.unsubscribe();
    this.subscriptions.set(pathName, { sub, signature });
  }

  /**
   * Diff and apply new config: only rebuild subscriptions whose signatures (or root signature) changed.
   * If there was no previous config (first load), we defer building until a widget calls observe().
   */
  applyStreamsConfigDiff(cfg: IWidgetSvcConfig | undefined): void {
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
      this.registrations = this.registrations.filter(x => x.pathName !== r);
    }
    const rootChanged = prevRootSig !== newRootSig;
    for (const p of newPaths) {
      const pathCfg = cfg.paths[p];
      if (!pathCfg?.path) continue;
      const sig = this.computePathSignature(pathCfg);
      const existing = this.subscriptions.get(p);
      if (!existing || existing.signature !== sig || rootChanged) {
        // Rebuild if we have at least one registration; otherwise just refresh base observable
        const regs = this.registrations.filter(r => r.pathName === p);
        if (!regs.length) {
          // Update base observable signature only
          this.ensureStreamsMap();
          this.streams!.set(p, this.dataService.subscribePath(pathCfg.path, pathCfg.source || 'default'));
          if (existing) { existing.sub.unsubscribe(); this.subscriptions.delete(p); }
        } else {
          for (const r of regs) {
            this.buildAndSubscribe(p, r.next, cfg, pathCfg);
          }
        }
      }
    }
  }

  /**
   * Register (idempotent) a consumer callback for a logical path key.
   *
   * Behavior:
   * - If this is the first registration for the path, a subscription pipeline is built (or rebuilt if signature changed).
   * - Duplicate registrations (same function reference for same key) are ignored.
   * - If config for the key is missing or path is empty, this is a no-op.
   * - Subsequent config diffs that change only other paths will not disturb this subscription.
   * - Path of type numeric are unit-converted
   * - All paths are sampled at the configured `sampleTime` (default: 1000ms).
   *
   * Idempotency Details:
   * - Re-calling with an identical callback for the same path does not resubscribe.
   * - Re-calling after the underlying path signature changes (e.g., unit, sampleTime) triggers a rebuild via diff logic.
   *
   * Lifecycle / Cleanup:
   * - Subscriptions are automatically cleaned up on directive destroy.
   * - When a path is removed from config, diff logic unsubscribes it and future emits stop.
   * - If you need to temporarily suspend updates, change the widget config to remove the path; re-adding will rebuild.
   *
   * Best Practices for Widget Authors:
   * 1. Call once per required path key inside `ngOnInit` or first render guard.
   * 2. Keep the callback stable (avoid recreating arrow functions every change detection if possible) to minimize diff noise.
   * 3. Perform minimal work in the callback; delegate heavy transforms to signals/computed properties.
   * 4. Avoid manual unsubscribe – the directive owns lifecycle.
   *
   * Example (single path numeric widget):
   * ```ts
   * this.streams.observe('speed', update => {
   *   this.speed.set(update.data.value as number);
   * });
   * ```
   *
   * Example (multiple paths):
   * ```ts
   * ['stw','sog'].forEach(k => this.streams.observe(k, u => this.values[k].set(u.data.value)));
   * ```
   *
   * @param pathName Logical path key defined in widget config (config.paths[pathName]).
   * @param next Callback invoked with each processed `IPathUpdate` (IMPORTANT: unit conversion and sampleTime are automatically applied before callback).
   */
  observe(pathName: string, next: (value: IPathUpdate) => void): void {
    // Avoid duplicate registration (same path & same callback reference)
    if (!this.registrations.find(r => r.pathName === pathName && r.next === next)) {
      this.registrations.push({ pathName, next });
    }
    const cfg = this._streamsConfig();
    if (!cfg || !cfg.paths?.[pathName]) return;
    const pathCfg = cfg.paths[pathName];
    const existing = this.subscriptions.get(pathName);
    const sig = this.computePathSignature(pathCfg);
    if (existing && existing.signature === sig) return; // already subscribed with current signature
    this.buildAndSubscribe(pathName, next, cfg, pathCfg);
  }

  /**
   * @deprecated Legacy full reset. Prefer diff-based `applyStreamsConfigDiff`.
   */
  reset(): void {
    this.subscriptions.forEach(s => s.sub.unsubscribe());
    this.subscriptions.clear();
    this.streams = undefined;
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
  }

  /**
   * @deprecated Legacy helper: full reset then re-observe registered callbacks.
   * Safe to remove once no external callers remain.
   */
  resetAndReobserve(): void {
    const regs = [...this.registrations];
    this.reset();
    for (const r of regs) this.observe(r.pathName, r.next);
  }
}
