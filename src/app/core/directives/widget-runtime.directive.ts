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

  // Combined user config and default widget config. If only default exists, use it.
  public options = computed<IWidgetSvcConfig | undefined>(() => {
    const base = this.defaultConfig();
    const user = this._runtimeConfig();
    if (base && user) {
      const merged = cloneDeep(merge({}, base, user));
      this.runtimeConfig.emit(merged);
      return merged;
    }
    if (base && !user) {
      // Emit base so dependents can start even before user customization
      const cloned = cloneDeep(base);
      this.runtimeConfig.emit(cloned);
      return cloned;
    }
    return undefined;
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
