import { Directive, computed, output, signal } from '@angular/core';
import { cloneDeep, merge } from 'lodash-es';
import type { IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Directive({
  selector: '[widget-runtime]',
  exportAs: 'widgetRuntime'
})
export class WidgetRuntimeDirective {
  protected runtimeConfig = output<IWidgetSvcConfig | undefined>();
  public defaultConfig = signal<IWidgetSvcConfig | undefined>(undefined);

  // Internal runtime config
  private _runtimeConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  private lastBaseRef: IWidgetSvcConfig | undefined;
  private lastUserRef: IWidgetSvcConfig | undefined;
  private lastMergedRef: IWidgetSvcConfig | undefined;

  // Combined user config and default widget config. If only default exists, use it.
  public options = computed<IWidgetSvcConfig | undefined>(() => {
    const base = this.defaultConfig();
    const user = this._runtimeConfig();
    // Fast path reuse if references unchanged
    if (this.lastMergedRef && base === this.lastBaseRef && user === this.lastUserRef) {
      return this.lastMergedRef;
    }
    let merged: IWidgetSvcConfig | undefined;
    if (base && user) {
      merged = merge(cloneDeep(base), cloneDeep(user));
    } else if (base && !user) {
      merged = cloneDeep(base);
    } else if (!base && user) {
      merged = cloneDeep(user);
    } else {
      merged = undefined;
    }
    this.lastBaseRef = base;
    this.lastUserRef = user;
    this.lastMergedRef = merged;
    this.runtimeConfig.emit(merged);
    return merged;
  });

  public firstPathKey = computed<string | undefined>(() => {
    const cfg = this.options();
    if (!cfg?.paths) return undefined;
    const keys = Object.keys(cfg.paths);
    return keys.length ? keys[0] : undefined;
  });

  public getPathCfg(pathKey: string) {
    const cfg = this.options();
    return cfg?.paths?.[pathKey];
  }

  public setRuntimeConfig(cfg: IWidgetSvcConfig | undefined) {
    this._runtimeConfig.set(cfg);
  }

  // Convenience for host component to initialize both default + saved
  public initialize(defaultCfg: IWidgetSvcConfig | undefined, savedCfg: IWidgetSvcConfig | undefined) {
    if (defaultCfg) this.defaultConfig.set(defaultCfg);
    if (savedCfg) this._runtimeConfig.set(savedCfg);
  }
}
