import { Directive, computed, input, signal } from '@angular/core';
import { cloneDeep, merge } from 'lodash-es';
import type { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import type { NgCompInputs } from 'gridstack/dist/angular';

@Directive({
  selector: '[widget-runtime]',
  exportAs: 'widgetRuntime',
  standalone: true
})
export class WidgetRuntimeDirective {
  runtimeWidget = input<IWidget>();
  runtimeDefaultConfig = input<IWidgetSvcConfig>();
  // Reactive config input for cases where only config object changes identity
  runtimeConfig = input<IWidgetSvcConfig>();

  // Programmatic runtime config set by host2 when it owns the model
  private _runtimeConfig = signal<IWidgetSvcConfig | undefined>(undefined);

  public config = computed<IWidgetSvcConfig | undefined>(() => {
    const d = this.runtimeDefaultConfig();
    const cfgInput = this.runtimeConfig();
    const cfgProg = this._runtimeConfig();
    const cfg = cfgInput ?? cfgProg;
    if (cfg) {
      return cloneDeep(merge({}, d ?? {}, cfg));
    }
    const w = this.runtimeWidget();
    if (!w) return d ? cloneDeep(d) : undefined;
    return cloneDeep(merge({}, d ?? {}, w.config ?? {}));
  });

  public firstPathKey = computed<string | undefined>(() => {
    const cfg = this.config();
    if (!cfg?.paths) return undefined;
    const keys = Object.keys(cfg.paths);
    return keys.length ? keys[0] : undefined;
  });

  public getPathCfg(pathKey: string) {
    const cfg = this.config();
    return cfg?.paths?.[pathKey];
  }

  public setRuntimeConfig(cfg: IWidgetSvcConfig | undefined) {
    this._runtimeConfig.set(cfg);
  }

  /**
   * Applies the provided config to the bound widget instance and updates the
   * directive's programmatic config, keeping both in sync.
   */
  public applyConfigToWidget(cfg: IWidgetSvcConfig): void {
    const w = this.runtimeWidget?.();
    if (w) {
      w.config = cloneDeep(cfg);
    }
    this.setRuntimeConfig(cfg);
  }

  /**
   * Returns Gridstack-compatible serializable inputs, mirroring BaseWidget.serialize().
   * This does not persist by itself; it exposes the current widgetProperties payload
   * from the dashboard service.
   */
  public serialize(): NgCompInputs {
    const w = this.runtimeWidget?.();
    // gridstack expects `{ widgetProperties }`
    return { widgetProperties: w as unknown as IWidget } as NgCompInputs;
  }
}
