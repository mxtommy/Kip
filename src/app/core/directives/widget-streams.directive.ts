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

  /** Diff and apply new config: only rebuild subscriptions whose signatures (or root signature) changed */
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

  // Legacy methods retained (now delegate) for backward compatibility
  reset(): void {
    this.subscriptions.forEach(s => s.sub.unsubscribe());
    this.subscriptions.clear();
    this.streams = undefined;
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
  }

  resetAndReobserve(): void {
    const regs = [...this.registrations];
    this.reset();
    for (const r of regs) this.observe(r.pathName, r.next);
  }
}
