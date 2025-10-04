import { Injectable, inject, signal } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { StorageService, Config } from './storage.service';
import { AppSettingsService } from './app-settings.service';
import { IAppConfig, IConfig, IThemeConfig } from '../interfaces/app-settings.interfaces';
import { v10IConfig, v10IThemeConfig } from '../interfaces/v10-config-interface';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import { Dashboard } from './dashboard.service';

// NOTE: This service encapsulates the legacy upgrade (fileVersion 9 / configVersion 10 -> 11)
// and provides an extendable structure for future upgrades (eg. 11 -> 12 handled elsewhere).
@Injectable({ providedIn: 'root' })
export class ConfigurationUpgradeService {
  private _storage = inject(StorageService);
  private _settings = inject(AppSettingsService);

  // Signals/state for UI binding if desired
  public upgrading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public messages = signal<string[]>([]);

  // Source versions we support upgrading FROM (remote file version & app.configVersion)
  private readonly legacyFileVersion = 9;
  private readonly legacyConfigVersion = 10;
  // Target version for this migration step
  private readonly targetConfigVersion = 12; // After upgrade we set to 12 (AppSettingsService may later handle 12 -> 13)

  // Static mapping of old widget.type to new selector values
  private static readonly widgetTypeToSelectorMap: Record<string, string> = {
    'WidgetNumeric': 'widget-numeric',
    'WidgetTextGeneric': 'widget-text',
    'WidgetDateGeneric': 'widget-datetime',
    'WidgetBooleanSwitch': 'widget-boolean-switch',
    'WidgetBlank': 'widget-blank',
    'WidgetStateComponent': 'widget-button',
    'WidgetSimpleLinearComponent': 'widget-simple-linear',
    'WidgetGaugeNgLinearComponent': 'widget-gauge-ng-linear',
    'WidgetGaugeNgRadialComponent': 'widget-gauge-ng-radial',
    'WidgetGaugeNgCompassComponent': 'widget-gauge-ng-compass',
    'WidgetGaugeComponent': 'widget-gauge-steel',
    'WidgetWindComponent': 'widget-wind-steer',
    'WidgetFreeboardskComponent': 'widget-freeboardsk',
    'WidgetAutopilotComponent': 'widget-autopilot',
    'WidgetDataChart': 'widget-data-chart',
    'WidgetRaceTimerComponent': 'widget-racetimer',
    'WidgetIframeComponent': 'widget-iframe',
    'WidgetTutorial': 'widget-tutorial'
  };

  /**
   * Entry point used by component to trigger upgrade.
   * Decides local vs remote based on StorageService.initConfig (remote present -> remote upgrade).
   */
  public runUpgrade(version: number): void {
    this.error.set(null);
    this.upgrading.set(true);
    this.messages.set([]);


    if (version === undefined) {
      // Remote (Signal K) configs
      this._storage.listConfigs(this.legacyFileVersion)
        .then(async (rootConfigs: Config[]) => {
          for (const rootConfig of rootConfigs) {
            const transformedConfig = await this.transformConfig(rootConfig);
            if (!transformedConfig) continue; // skip if not eligible

            if (transformedConfig.scope === 'global') {
              try {
                this._storage.patchGlobal(transformedConfig.name, transformedConfig.scope, transformedConfig.newConfiguration, 'add');
                this._storage.patchGlobal(transformedConfig.name, transformedConfig.scope, transformedConfig.oldConfiguration, 'replace', this.legacyFileVersion);
                this.pushMsg(`[Upgrade] Configuration ${transformedConfig.scope}/${transformedConfig.name} upgraded to version ${this.targetConfigVersion}. Old configuration patched to version 0.`);
              } catch {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}`);
              }
            } else {
              try {
                await this._storage.setConfig(transformedConfig.scope, transformedConfig.name, transformedConfig.newConfiguration);
                await this._storage.setConfig(transformedConfig.scope, transformedConfig.name, transformedConfig.oldConfiguration, this.legacyFileVersion);
                this.pushMsg(`[Upgrade] Configuration ${transformedConfig.scope}/${transformedConfig.name} upgraded to version ${this.targetConfigVersion}. Old configuration patched to version 0.`);
              } catch (error) {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}: ${(error as Error).message}`);
              }
            }
          }
          // After processing remote configs, reload
          setTimeout(() => this._settings.reloadApp(), 1500);
        })
        .catch(error => {
          this.pushError('Error fetching configuration data: ' + (error as Error).message);
        })
        .finally(() => this.upgrading.set(false));

    } else if (version === 11 && this._settings.useSharedConfig) {
      // Remote (Signal K) configs
      this._storage.listConfigs(11)
        .then(async (rootConfigs: Config[]) => {
          for (const rootConfig of rootConfigs) {

            // Optional throttle / UX pacing: wait 500ms before finalizing this config
            await new Promise(resolve => setTimeout(resolve, 500));

            const upgradedConfig = await this.upgradeConfig(rootConfig);
            if (!upgradedConfig) continue; // skip if not eligible

            if (upgradedConfig.scope === 'global') {
              try {
                this._storage.patchGlobal(upgradedConfig.name, upgradedConfig.scope, upgradedConfig.configuration, 'replace');
                this.pushMsg(`[Upgrade] Configuration ${upgradedConfig.scope}/${upgradedConfig.name} upgraded to version 12.`);
              } catch {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}`);
              }
            } else {
              try {
                await this._storage.setConfig(upgradedConfig.scope, upgradedConfig.name, upgradedConfig.configuration);
                this.pushMsg(`[Upgrade] Configuration ${upgradedConfig.scope}/${upgradedConfig.name} upgraded to version 12.`);
              } catch (error) {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}: ${(error as Error).message}`);
              }
            }
          }
          // After processing remote configs, reload
          setTimeout(() => this._settings.reloadApp(), 1500);
        })
        .catch(error => {
          this.pushError('Error fetching configuration data: ' + (error as Error).message);
        })
        .finally(() => this.upgrading.set(false));

    } else if (version === 11 && !this._settings.useSharedConfig) {
      const upgradedConfig: IConfig = { app: null, dashboards: null, theme: null };
      upgradedConfig.app = this._settings.getAppConfig();
      upgradedConfig.dashboards = this._settings.getDashboardConfig();
      upgradedConfig.theme = this._settings.getThemeConfig();

      upgradedConfig.app.configVersion = this.targetConfigVersion;
      this.upgradeDashboardWidgets(upgradedConfig.dashboards);

      localStorage.setItem('appConfig', JSON.stringify(upgradedConfig.app));
      localStorage.setItem('dashboardsConfig', JSON.stringify(upgradedConfig.dashboards));
      localStorage.setItem('themeConfig', JSON.stringify(upgradedConfig.theme));
      setTimeout(() => this._settings.reloadApp(), 1500);
      this.upgrading.set(false);
    } else {
      // LocalStorage upgrade path for config version 10
      const localStorageConfig: v10IConfig = { app: null, widget: null, layout: null, theme: null };
      localStorageConfig.app = this._settings.loadConfigFromLocalStorage('appConfig');
      localStorageConfig.widget = this._settings.loadConfigFromLocalStorage('widgetConfig');
      localStorageConfig.layout = this._settings.loadConfigFromLocalStorage('layoutConfig');
      localStorageConfig.theme = this._settings.loadConfigFromLocalStorage('themeConfig');

      const transformedApp = this.transformApp(localStorageConfig.app as IAppConfig);
      const transformedTheme = this.transformTheme(localStorageConfig.theme);
      const rootSplits = localStorageConfig.layout?.rootSplits || [];
      const splitSets = localStorageConfig.layout?.splitSets || [];
      const widgets = localStorageConfig.widget?.widgets || [];

      const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
        const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);
        return { id: rootSplitUUID, name: `Dashboard ${i + 1}`, configuration };
      });

      localStorage.setItem('appConfig', JSON.stringify(transformedApp));
      localStorage.setItem('dashboardsConfig', JSON.stringify(dashboards));
      localStorage.setItem('themeConfig', JSON.stringify(transformedTheme));
      setTimeout(() => this._settings.reloadApp(), 1500);
      this.upgrading.set(false);
    }
  }

  /** Retire old configs without migrating (start fresh) */
  public startFresh(): void {
    this.error.set(null);
    this.upgrading.set(true);

    if (this._storage.initConfig === null) {
      this._storage.listConfigs(this.legacyFileVersion)
        .then(async (rootConfigs: Config[]) => {
          for (const rootConfig of rootConfigs) {
            const oldConfiguration = await this._storage.getConfig(rootConfig.scope, rootConfig.name, this.legacyFileVersion) as unknown as IConfig;
            oldConfiguration.app.configVersion = 0; // retire
            if (rootConfig.scope === 'global') {
              try {
                setTimeout(() => {
                  this._storage.patchGlobal(rootConfig.name, rootConfig.scope, oldConfiguration, 'replace', this.legacyFileVersion);
                  this.pushMsg(`[Retired] Configuration ${rootConfig.scope}/${rootConfig.name} patched to version 0.`);
                }, 750);
              } catch {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}.`);
              }
            } else {
              try {
                await this._storage.setConfig(rootConfig.scope, rootConfig.name, oldConfiguration, this.legacyFileVersion);
                this.pushMsg(`[Retired] Configuration ${rootConfig.scope}/${rootConfig.name} patched to version 0.`);
              } catch {
                this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}.`);
              }
            }
          }
        })
        .catch(error => this.pushError('Error fetching configuration data: ' + (error as Error).message))
        .finally(() => {
          this.upgrading.set(false);
          this._settings.resetSettings();
          // close handled by component dialog; service only reloads on upgrade path
        });
    } else {
      const localStorageConfig: IConfig = { app: null, dashboards: null, theme: null };
      localStorageConfig.app = this._settings.loadConfigFromLocalStorage('appConfig');
      localStorageConfig.theme = this._settings.loadConfigFromLocalStorage('themeConfig');
      localStorageConfig.app.configVersion = this.targetConfigVersion; // baseline fresh
      localStorageConfig.app.nightModeBrightness = 0.27;
      localStorageConfig.theme.themeName = '';
      localStorage.setItem('appConfig', JSON.stringify(localStorageConfig.app));
      localStorage.setItem('themeConfig', JSON.stringify(localStorageConfig.theme));
      localStorage.removeItem('widgetConfig');
      localStorage.removeItem('layoutConfig');
      this.upgrading.set(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async transformConfig(rootConfig: Config): Promise<any> {
    const config = await this._storage.getConfig(rootConfig.scope, rootConfig.name, this.legacyFileVersion) as unknown as v10IConfig;
    if (config.app.configVersion !== this.legacyConfigVersion) {
      this.pushError(`[Upgrade Service] ${rootConfig.scope}/${rootConfig.name} is not an upgradable version ${this.legacyConfigVersion} config. Skipping.`);
      return null;
    }
    const transformedApp = this.transformApp(config.app as IAppConfig);
    const transformedTheme = this.transformTheme(config.theme);
    const rootSplits = config.layout?.rootSplits || [];
    const splitSets = config.layout?.splitSets || [];
    const widgets = config.widget?.widgets || [];
    const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
      const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);
      return { id: rootSplitUUID, name: `Dashboard ${i + 1}`, configuration };
    });
    const oldConf: v10IConfig = cloneDeep(config);
    oldConf.app.configVersion = 0; // retired
    return {
      scope: rootConfig.scope,
      name: rootConfig.name,
      newConfiguration: { app: transformedApp, theme: transformedTheme, dashboards },
      oldConfiguration: oldConf
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformWidget(config: any, widgetType: string): any {
    if (config.color === 'white') config.color = 'contrast';
    if (config.textColor) {
      switch (config.textColor) {
        case 'text': config.color = 'contrast'; break;
        case 'primary': config.color = 'blue'; break;
        case 'accent': config.color = 'yellow'; break;
        case 'warn': config.color = 'purple'; break;
        case 'nobar':
          if (widgetType === 'WidgetGaugeNgLinearComponent') {
            config.color = 'blue';
            config.gauge = config.gauge || {};
            config.gauge.useNeedle = false;
          }
          break;
        default: config.color = config.textColor;
      }
      delete config.textColor;
    }
    return config;
  }

  private transformApp(app: IAppConfig): IAppConfig {
    if (!app) return null;
    app.configVersion = this.targetConfigVersion;
    app.nightModeBrightness = 0.27;
    return app;
  }

  private transformTheme(theme: v10IThemeConfig): IThemeConfig {
    if (!theme) return null;
    const themeConfig: IThemeConfig = { themeName: '' };
    return themeConfig;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async upgradeConfig(rootConfig: Config): Promise<any> {
    const config:IConfig = await this._storage.getConfig(rootConfig.scope, rootConfig.name);
    try {
      if (config.app.configVersion !== 11) {
        this.pushError(`[Upgrade Service] ${rootConfig.scope}/${rootConfig.name} is not an upgradable version 12 config. Skipping.`);
        return null;
      }
      // Iterate dashboards and force widget selector to 'widget-host2'
      let updatedWidgetCount = 0;
      if (Array.isArray(config.dashboards)) {
        for (const dash of config.dashboards) {
          if (dash && Array.isArray(dash.configuration)) {
            for (const widget of dash.configuration) {
              if (widget && typeof widget === 'object') {
                if (widget.selector !== 'widget-host2') {
                  widget.selector = 'widget-host2';
                  updatedWidgetCount++;
                }
              }
            }
          }
        }
      }
      if (updatedWidgetCount) {
        this.pushMsg(`[Upgrade] Updated ${updatedWidgetCount} widget selector(s) to 'widget-host2' for ${rootConfig.scope}/${rootConfig.name}.`);
      }

      config.app.configVersion = 12;

      return {
        scope: rootConfig.scope,
        name: rootConfig.name,
        configuration: { app: config.app, theme: config.theme, dashboards: config.dashboards }
      };
    } catch (error) {
      this.pushError(`[Upgrade Service] Error upgrading ${rootConfig.scope}/${rootConfig.name}: ${(error as Error).message}`);
      return null;
    }
  }

  private upgradeDashboardWidgets(dashboards: Dashboard[]): void {
      // Iterate dashboards and force widget selector to 'widget-host2'
      let updatedWidgetCount = 0;
      if (Array.isArray(dashboards)) {
        for (const dash of dashboards) {
          if (dash && Array.isArray(dash.configuration)) {
            for (const widget of dash.configuration) {
              if (widget && typeof widget === 'object') {
                if (widget.selector !== 'widget-host2') {
                  widget.selector = 'widget-host2';
                  updatedWidgetCount++;
                }
              }
            }
          }
        }
      }
      if (updatedWidgetCount) {
        this.pushMsg(`[Upgrade] Updated ${updatedWidgetCount} localStorage widget selector(s) to 'widget-host2'.`);
      }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractWidgetsFromSplitSets(splitSets: any[], widgets: any[], rootSplitUUID: string): NgGridStackWidget[] {
    const widgetMap = new Map(widgets.map(widget => [widget.uuid, widget]));
    const extractedWidgets: NgGridStackWidget[] = [];
    const issues: string[] = [];
    let x = 0; let y = 0; // grid cursor
    const gridWidth = 12; const gridHeight = 12; const widgetWidth = 2; const widgetHeight = 2;
    const traverseSplitSets = (splitSetUUID: string) => {
      const splitSet = splitSets.find(set => set.uuid === splitSetUUID);
      if (!splitSet) { issues.push(`Missing splitSet with UUID: ${splitSetUUID}`); return; }
      splitSet.splitAreas.forEach(area => {
        if (area.type === 'widget') {
          const widget = widgetMap.get(area.uuid);
            if (widget) {
              if (widget.type === 'WidgetBlank') { return; }
              if (y + widgetHeight > gridHeight) { issues.push(`No space left for widget: ${widget.uuid}`); return; }
              const selector = ConfigurationUpgradeService.widgetTypeToSelectorMap[widget.type] || 'widget-unknown';
              const transformedConfig = this.transformWidget(widget.config, widget.type);
              extractedWidgets.push({
                id: widget.uuid,
                selector: 'widget-host2',
                input: { widgetProperties: { type: selector, uuid: widget.uuid, config: transformedConfig } },
                x, y, w: widgetWidth, h: widgetHeight
              });
              x += widgetWidth; if (x >= gridWidth) { x = 0; y += widgetHeight; }
            } else { issues.push(`Missing widget with UUID: ${area.uuid}`); }
        } else if (area.type === 'splitSet') { traverseSplitSets(area.uuid); }
      });
    };
    traverseSplitSets(rootSplitUUID);
    if (issues.length) { this.pushMsg('Transformation Issues: ' + issues.join('; ')); }
    return extractedWidgets;
  }

  private pushMsg(msg: string) {
    this.messages.update(list => [...list, msg]);
  }

  private pushError(msg: string) {
    this.error.set(msg);
    this.pushMsg(msg); }
}
