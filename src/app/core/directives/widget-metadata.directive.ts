import { Directive, DestroyRef, inject, input, signal } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../services/data.service';
import { ISkZone } from '../interfaces/signalk-interfaces';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { WidgetRuntimeDirective } from './widget-runtime.directive';

@Directive({
  selector: '[widget-metadata]',
  exportAs: 'widgetMetadata'
})
export class WidgetMetadataDirective {
  metaConfig = input<IWidgetSvcConfig>();
  metaWidget = input<IWidget>();

  // Programmatic config/widget owned by Host2
  private _metaConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  public setMetaConfig(cfg: IWidgetSvcConfig | undefined) { this._metaConfig.set(cfg); }

  zones$ = new BehaviorSubject<ISkZone[]>([]);

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private reset$ = new Subject<void>();
  private lastKey: string | undefined;
  private currentPath: string | undefined;
  private currentSub: Subscription | undefined;
  private pathSignature: string | undefined;

  observe(pathKey?: string): void {
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
    this.currentPath = path;
    const sub = this.dataService.getPathMetaObservable(path)
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
    this.currentSub = sub;
  }

  reset(): void {
    this.reset$.next();
    this.reset$.complete();
    this.reset$ = new Subject<void>();
    if (this.currentSub) {
      this.currentSub.unsubscribe();
      this.currentSub = undefined;
    }
    this.currentPath = undefined;
    this.pathSignature = undefined;
    this.zones$.next([]);
  }

  resetAndReobserve(): void {
    let key = this.lastKey;
    const cfg = this.runtime?.options() ?? this._metaConfig() ?? this.metaConfig();
    if (cfg?.paths && key && !cfg.paths[key]) {
      key = undefined;
    }
    this.reset();
    this.observe(key);
  }

  // Diff-based config application: only resubscribe if primary path actually changed
  applyMetaConfigDiff(cfg: IWidgetSvcConfig | undefined): void {
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
}
