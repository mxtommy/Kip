import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../services/data.service';
import { ISkZone } from '../interfaces/signalk-interfaces';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { WidgetRuntimeDirective } from './widget-runtime.directive';

@Directive({
  selector: '[widget-meta]',
  exportAs: 'widgetMeta'
})
export class WidgetMetaDirective {
  metaConfig = input<IWidgetSvcConfig>();
  metaWidget = input<IWidget>();

  // Programmatic config/widget owned by Host2
  private _metaConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  private _metaWidget = signal<IWidget | undefined>(undefined);
  public setMetaConfig(cfg: IWidgetSvcConfig | undefined) { this._metaConfig.set(cfg); }
  public setMetaWidget(w: IWidget | undefined) { this._metaWidget.set(w); }

  zones$ = new BehaviorSubject<ISkZone[]>([]);

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private reset$ = new Subject<void>();
  private lastKey: string | undefined;

  observe(pathKey?: string): void {
  const cfg = this.runtime?.config() ?? this._metaConfig() ?? this.metaConfig();
    if (!cfg?.paths || Object.keys(cfg.paths).length === 0) return;

    const key = pathKey || Object.keys(cfg.paths)[0];
    this.lastKey = key;
    const path = cfg.paths[key]?.path;
    if (!path) return;

    this.dataService.getPathMetaObservable(path)
      .pipe(
        takeUntil(this.reset$),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(meta => {
        if (!meta) {
          this.zones$.next([]);
        } else if (meta.zones) {
          this.zones$.next(meta.zones);
        } else {
          this.zones$.next([]);
        }
      });
  }

  reset(): void {
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
    this.zones$.next([]);
  }

  resetAndReobserve(): void {
    let key = this.lastKey;
  const cfg = this.runtime?.config() ?? this._metaConfig() ?? this.metaConfig();
    if (cfg?.paths && key && !cfg.paths[key]) {
      key = undefined as unknown as string; // force fallback to first path inside observe
    }
    this.reset();
    this.observe(key);
  }
}
