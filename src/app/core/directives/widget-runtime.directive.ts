import { Directive, computed, effect, input, output, signal, untracked } from '@angular/core';
import { cloneDeep, merge } from 'lodash-es';
import type { IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Directive({
  selector: '[widget-runtime]',
  exportAs: 'widgetRuntime'
})
/**
 * Runtime directive merges a widget's default configuration with the (possibly user-edited)
 * saved configuration. It memoizes the merged object to provide a stable reference unless
 * either source reference changes, reducing downstream signal churn.
 */
export class WidgetRuntimeDirective {
  // Manual config input (optional override, typically for embedded hardcoded widgets. See widget-autopilot)
  public config = input<IWidgetSvcConfig | undefined>();

  // Default config input (typically from widget manifest DEFAULT_CONFIG)
  protected defaultConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  protected runtimeConfig = output<IWidgetSvcConfig | undefined>();

  // Internal runtime config
  private _runtimeConfig = signal<IWidgetSvcConfig | undefined>(undefined);
  private lastBaseRef: IWidgetSvcConfig | undefined;
  private lastUserRef: IWidgetSvcConfig | undefined;
  private lastMergedRef: IWidgetSvcConfig | undefined;

  /**
   * Merged runtime options (default + user). Returns identical object instance when
   * neither underlying reference changed, enabling efficient consumers.
   */
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

  /** Convenience: first configured path key (widgets needing only a single path can use this). */
  public firstPathKey = computed<string | undefined>(() => {
    const cfg = this.options();
    if (!cfg?.paths) return undefined;
    const keys = Object.keys(cfg.paths);
    return keys.length ? keys[0] : undefined;
  });

  constructor() {
    effect(() => {
      const conf = this.config();
      untracked(() => {
        if (conf) this.setRuntimeConfig(conf);
      });
    });
  }

  /** Retrieve a single path config safely from current merged options. */
  public getPathCfg(pathKey: string): string | undefined {
    const cfg = this.options();
    return cfg?.paths?.[pathKey];
  }

  /** Set (replace) the user runtime portion of the configuration. */
  public setRuntimeConfig(cfg: IWidgetSvcConfig | undefined): void {
    this._runtimeConfig.set(cfg);
  }

  /** Seed both default and saved configs (called once by Host2 before child creation). */
  public initialize(defaultCfg: IWidgetSvcConfig | undefined, savedCfg: IWidgetSvcConfig | undefined): void {
    if (defaultCfg) this.defaultConfig.set(defaultCfg);
    if (savedCfg) this._runtimeConfig.set(savedCfg);
  }
}
