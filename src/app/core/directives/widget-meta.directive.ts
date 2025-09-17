import { Directive, DestroyRef, inject, input } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../services/data.service';
import { ISkZone } from '../interfaces/signalk-interfaces';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Directive({
  selector: '[widget-meta]',
  exportAs: 'widgetMeta'
})
export class WidgetMetaDirective {
  metaConfig = input.required<IWidgetSvcConfig>();
  metaWidget = input.required<IWidget>();

  zones$ = new BehaviorSubject<ISkZone[]>([]);

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private reset$ = new Subject<void>();

  observe(pathKey?: string): void {
    const cfg = this.metaConfig();
    if (!cfg?.paths || Object.keys(cfg.paths).length === 0) return;

    const key = pathKey || Object.keys(cfg.paths)[0];
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
}
