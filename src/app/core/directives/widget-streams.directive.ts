import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { DataService, IPathUpdate } from '../services/data.service';
import { UnitsService } from '../services/units.service';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { Observable, Observer, Subject, delayWhen, map, retryWhen, sampleTime, tap, throwError, timeout, timer, takeUntil, take, merge } from 'rxjs';
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
  private _streamsWidget = signal<IWidget | undefined>(undefined);
  public setStreamsConfig(cfg: IWidgetSvcConfig | undefined) { this._streamsConfig.set(cfg); }
  public setStreamsWidget(w: IWidget | undefined) { this._streamsWidget.set(w); }

  private readonly dataService = inject(DataService);
  private readonly unitsService = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private streams: { pathName: string; observable: Observable<IPathUpdate> }[] | undefined;
  private reset$ = new Subject<void>();
  private registrations: { pathName: string; next: (value: IPathUpdate) => void }[] = [];

  buildObserver(pathKey: string, next: ((value: IPathUpdate) => void)): Observer<IPathUpdate> {
    return {
      next: v => next(v),
      error: err => console.error('[Widget] Observer got an error: ' + err),
      complete: () => {}
    };
  }

  createObservables(): void {
    const cfg = this._streamsConfig();
    if (!cfg?.paths) { this.streams = undefined; return; }
    const entries = Object.entries(cfg.paths);
    if (!entries.length) { this.streams = undefined; return; }
    this.streams = entries
      .filter(([, p]) => typeof p.path === 'string' && !!p.path)
      .map(([key, p]) => ({
        pathName: key,
        observable: this.dataService.subscribePath(p.path, p.source || 'default'),
      }));
  }

  observe(pathName: string, next: (value: IPathUpdate) => void): void {
    // Track registration to allow re-observe on resets/config updates
    this.registrations.push({ pathName, next });
    const cfg =  this._streamsConfig();
    if (!cfg) return;
    if (!this.streams || !this.streams.length) this.createObservables();

    const pathCfg = cfg.paths[pathName];
    if (!pathCfg) return;
    const pathType = pathCfg.pathType;
    const path = pathCfg.path;
    const convert = pathCfg.convertUnitTo;
    let sample = Number(pathCfg.sampleTime);
    if (!Number.isFinite(sample) || sample <= 0) sample = 1000;
    const enableTimeout = !!cfg.enableTimeout;
    const dataTimeout = (cfg.dataTimeout ?? 5) * 1000;
    const retryDelay = 5000;
    const timeoutErrorMsg = `[Widget] ${cfg.displayName} - ${dataTimeout / 1000} second data update timeout reached for `;
    const retryErrorMsg = `[Widget] ${cfg.displayName} - Retrying in ${retryDelay / 1000} seconds`;

    const stream = this.streams!.find(s => s.pathName === pathName);
    if (!stream) return;

    const toUnit = (val: number) => convert ? this.unitsService.convertToUnit(convert, val) : val;

    let data$: Observable<IPathUpdate> = stream.observable;

    if (pathType === 'number') {
      data$ = data$.pipe(
        map(x => ({ data: { value: toUnit(x.data.value as number), timestamp: x.data.timestamp }, state: x.state } as IPathUpdate))
      );
    } else if (pathType === 'string' || pathType === 'Date') {
      // pass-through; sampling handled below
    } else { // boolean
      // pass-through; sampling handled below
    }

    const initial$ = data$.pipe(take(1));
    const sampled$ = data$.pipe(sampleTime(sample));
    data$ = merge(initial$, sampled$);

    if (enableTimeout) {
      data$ = data$.pipe(
        timeout({
          each: dataTimeout,
          with: () => throwError(() => {
            console.log(timeoutErrorMsg + path);
            this.dataService.timeoutPathObservable(path, pathType);
          })
        }),
        retryWhen(error => error.pipe(
          tap(() => console.log(retryErrorMsg)),
          delayWhen(() => timer(retryDelay))
        ))
      );
    }

    const observer = this.buildObserver(pathName, next);
    data$
      .pipe(
        takeUntil(this.reset$),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(observer);
  }

  reset(): void {
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
    this.streams = undefined;
  }

  resetAndReobserve(): void {
    this.reset();
    const regs = [...this.registrations];
    this.registrations = []; // re-added by observe
    for (const r of regs) {
      this.observe(r.pathName, r.next);
    }
  }
}
