import { Directive, computed, input } from '@angular/core';
import { cloneDeep, merge } from 'lodash-es';
import type { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Directive({
  selector: '[widget-runtime]',
  exportAs: 'widgetRuntime',
  standalone: true
})
export class WidgetRuntimeDirective {
  runtimeWidget = input.required<IWidget>();
  runtimeDefaultConfig = input<IWidgetSvcConfig>();
  // Reactive config input for cases where only config object changes identity
  runtimeConfig = input<IWidgetSvcConfig>();

  config = computed<IWidgetSvcConfig | undefined>(() => {
    const d = this.runtimeDefaultConfig();
    const cfg = this.runtimeConfig();
    if (cfg) {
      return cloneDeep(merge({}, d ?? {}, cfg));
    }
    const w = this.runtimeWidget();
    if (!w) return d ? cloneDeep(d) : undefined;
    return cloneDeep(merge({}, d ?? {}, w.config ?? {}));
  });

  firstPathKey = computed<string | undefined>(() => {
    const cfg = this.config();
    if (!cfg?.paths) return undefined;
    const keys = Object.keys(cfg.paths);
    return keys.length ? keys[0] : undefined;
  });

  getPathCfg(pathKey: string) {
    const cfg = this.config();
    return cfg?.paths?.[pathKey];
  }
}
