import { Injectable, inject, signal } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { StorageService, Config } from './storage.service';
import { AppSettingsService } from './app-settings.service';
import { IAppConfig, IConfig, IThemeConfig } from '../interfaces/app-settings.interfaces';
import { v10IConfig, v10IThemeConfig } from '../interfaces/v10-config-interface';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import { Dashboard } from './dashboard.service';

interface DataChartConfigUpdate {
  datachartPath: string;
  datachartSource: string;
  period: number;
  timeScale: string;
  datasetUUID: string;
}

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
  public async runUpgrade(version: number): Promise<void> {
    this.error.set(null);
    this.upgrading.set(true);
    this.messages.set([]);


    if (version === undefined) {
      // Remote (Signal K) configs
      try {
        const rootConfigs = await this._storage.listConfigs(this.legacyFileVersion);
        for (const rootConfig of rootConfigs) {
          const transformedConfig = await this.transformConfig(rootConfig);
          if (!transformedConfig) continue; // skip if not eligible

          try {
            // Write upgraded config to current active file version
            await this._storage.setConfig(
              transformedConfig.scope,
              transformedConfig.name,
              transformedConfig.newConfiguration
            );
            // Retire legacy set in legacy file version
            await this._storage.setConfig(
              transformedConfig.scope,
              transformedConfig.name,
              transformedConfig.oldConfiguration,
              this.legacyFileVersion
            );
            this.pushMsg(`[Upgrade] Configuration ${transformedConfig.scope}/${transformedConfig.name} upgraded to version ${this.targetConfigVersion}. Old configuration patched to version 0.`);
          } catch (error) {
            this.pushError(`[Upgrade] Error saving configuration for ${rootConfig.name}: ${(error as Error).message}`);
          }
        }
        // After processing remote configs, reload
        setTimeout(() => this._settings.reloadApp(), 1500);
      } catch (error) {
        this.pushError('Error fetching configuration data: ' + (error as Error).message);
      }

    } else if (version === 11 && this._settings.useSharedConfig) {
      // Remote (Signal K) configs
      try {
        const configsList: Config[] = await this._storage.listConfigs(11);

        for (const item of configsList) {
          try {
            const config = await this._storage.getConfig(item.scope, item.name, 11);
            const originalConfig = cloneDeep(config);

            this.pushMsg(`[Upgrade] Saving configuration backup to file ${item.scope}/${item.name}...`);
            await this._storage.setConfig(
              item.scope,
              item.name,
              originalConfig,
              11.99
            );

            this.pushMsg(`[Upgrade] ${item.scope}/${item.name} -> v${this.targetConfigVersion}.`);
            const migratedConfig = this.upgradeConfig(config);
            if (!migratedConfig) continue; // skip if not eligible

            this.pushMsg(`[Upgrade] Saving upgraded configurations...`);
            await this._storage.setConfig(
              item.scope,
              item.name,
              migratedConfig
            );
          } catch (error) {
            this.pushError(`[Upgrade] Error upgrading ${item.scope}/${item.name}: ${(error as Error).message}`);
          }
        }
        // After processing remote configs, reload
        this.pushMsg(`[Upgrade] Reloading app to finalize upgrade...`);
        setTimeout(() => this._settings.reloadApp(), 1500);
      } catch (error) {
        this.pushError('Error fetching configuration data. Aborting upgrade. Details: ' + (error as Error).message);
      }

    } else if (version === 11 && !this._settings.useSharedConfig) {
      // LocalStorage upgrade path for config version 11
      const upgradedConfig: IConfig = { app: null, dashboards: null, theme: null };
      upgradedConfig.app = this._settings.getAppConfig();
      upgradedConfig.dashboards = this._settings.getDashboardConfig();
      upgradedConfig.theme = this._settings.getThemeConfig();

      upgradedConfig.app.configVersion = this.targetConfigVersion;
      this.addSplitShellConfigKeys(upgradedConfig.app);
      const datasetInfo = this.extractAppDatasets(upgradedConfig.app);
      this.upgradeDashboardWidgets(upgradedConfig.dashboards);
      this.migrateDatasetsToDataCharts(datasetInfo, upgradedConfig.dashboards);
      this.migrateUseNeedleToEnableNeedle(upgradedConfig.dashboards);

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
      const datasetInfo = this.extractAppDatasets(transformedApp);
      const transformedTheme = this.transformTheme(localStorageConfig.theme);
      const rootSplits = localStorageConfig.layout?.rootSplits || [];
      const splitSets = localStorageConfig.layout?.splitSets || [];
      const widgets = localStorageConfig.widget?.widgets || [];

      const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
        const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);
        return { id: rootSplitUUID, name: `Dashboard ${i + 1}`, configuration };
      });

      this.migrateDatasetsToDataCharts(datasetInfo, dashboards);
      this.migrateUseNeedleToEnableNeedle(dashboards);

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
    const datasetInfo = this.extractAppDatasets(transformedApp);
    const transformedTheme = this.transformTheme(config.theme);
    const rootSplits = config.layout?.rootSplits || [];
    const splitSets = config.layout?.splitSets || [];
    const widgets = config.widget?.widgets || [];
    const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
      const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);
      return { id: rootSplitUUID, name: `Dashboard ${i + 1}`, configuration };
    });
    this.migrateDatasetsToDataCharts(datasetInfo, dashboards);
    this.migrateUseNeedleToEnableNeedle(dashboards);
    const oldConf: v10IConfig = cloneDeep(config);
    oldConf.app.configVersion = 0; // retired
    return {
      scope: rootConfig.scope,
      name: rootConfig.name,
      newConfiguration: { app: transformedApp, theme: transformedTheme, dashboards },
      oldConfiguration: oldConf
    };
  }

  private extractAppDatasets(transformedApp: IAppConfig): DataChartConfigUpdate[] {
    if (!transformedApp || !Array.isArray(transformedApp.dataSets)) return [];
    let updatedDatasetCount = 0;

    // Find indices of datasets to extract and remove
    const indicesToRemove: number[] = [];
    const updates: DataChartConfigUpdate[] = [];

    transformedApp.dataSets.forEach((ds, idx) => {
      if (ds.editable === true || ds.editable === undefined) {
        updates.push({
          period: ds.period,
          datachartPath: ds.path,
          datachartSource: ds.pathSource,
          timeScale: ds.timeScaleFormat,
          datasetUUID: ds.uuid
        });
        indicesToRemove.push(idx);
        updatedDatasetCount++;
      }
    });

    // Remove in reverse order to avoid index shifting
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      transformedApp.dataSets.splice(indicesToRemove[i], 1);
    }

    if (updatedDatasetCount) {
      this.pushMsg(`[Upgrade] Retired ${updatedDatasetCount} Dataset(s).`);
    }

    return updates;
  }

  private migrateDatasetsToDataCharts(datasetInfo: DataChartConfigUpdate[], dashboards: Dashboard[]): void {
    if (!Array.isArray(datasetInfo) || datasetInfo.length === 0) return;
    if (!Array.isArray(dashboards)) return;

    dashboards.forEach(dashboard => {
      let updatedDatachartCount = 0;
      if (dashboard && Array.isArray(dashboard.configuration)) {
        dashboard.configuration.forEach((widget: NgGridStackWidget) => {
          if (widget && typeof widget === 'object' && widget.input?.widgetProperties?.config) {
            const dataset = datasetInfo.find(ds => ds.datasetUUID === widget.input?.widgetProperties?.config.datasetUUID);
            if (dataset) {
              // Add or replace all dataset properties except 'datasetUUID'
              Object.entries(dataset).forEach(([key, value]) => {
                if (key !== 'datasetUUID') {
                  widget.input.widgetProperties.config[key] = value;
                }
              });
              delete widget.input.widgetProperties.config?.datasetUUID;
              delete widget.input.widgetProperties.config?.timeScaleFormat;
              updatedDatachartCount++;
            }
          }
        });
        if (updatedDatachartCount) {
          this.pushMsg(`[Upgrade] Migrated ${updatedDatachartCount} Realtime Data Chart widget(s).`);
        }
      }
    });
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
    const clone = cloneDeep(app);
    clone.configVersion = this.targetConfigVersion;
    clone.nightModeBrightness = 0.27;
    clone.splitShellEnabled = false;
    clone.splitShellSide = "left";
    clone.splitShellWidth = 0.2;
    clone.splitShellSwipeDisabled = false;
    return clone;
  }

  private transformTheme(theme: v10IThemeConfig): IThemeConfig {
    if (!theme) return null;
    const themeConfig: IThemeConfig = { themeName: '' };
    return themeConfig;
  }

  private upgradeConfig(config: IConfig): IConfig | null {
    try {
      if (config.app.configVersion !== 11) {
        this.pushError(`[Upgrade Service] Config version ${config.app.configVersion} upgrade is not supported. Skipping...`);
        return null;
      }
      this.addSplitShellConfigKeys(config.app);
      const datasetInfo = this.extractAppDatasets(config.app);
      this.migrateDatasetsToDataCharts(datasetInfo, config.dashboards);
      this.migrateUseNeedleToEnableNeedle(config.dashboards);
      // Iterate dashboards and force widget selector to 'widget-host2'
      let updatedWidgetCount = 0;
      let dimensionUpdatedCount = 0;
      if (Array.isArray(config.dashboards)) {
        for (const dash of config.dashboards) {
          if (dash && Array.isArray(dash.configuration)) {
            for (const widget of dash.configuration) {
              if (widget && typeof widget === 'object') {
                if (widget.selector !== 'widget-host2') {
                  widget.selector = 'widget-host2';
                  updatedWidgetCount++;
                }
                // Helper to safely double a numeric property if > 0 (handles undefined and numeric strings)
                const maybeDouble = (prop: string) => {
                  const raw = widget[prop] as unknown;
                  const numVal = typeof raw === 'string' ? Number(raw) : (raw as number);
                  if (Number.isFinite(numVal) && numVal !== 0) {
                    widget[prop] = numVal * 2;
                    dimensionUpdatedCount++;
                  }
                };
                maybeDouble('w');
                maybeDouble('h');
                maybeDouble('x');
                maybeDouble('y');

                // If width/height were missing, add them using minW/minH (or 2)
                if (widget['w'] === undefined || widget['w'] === null) {
                  const minW = widget['minW'];
                  const baseW = minW ? minW : 2;
                  widget['w'] = baseW;
                  dimensionUpdatedCount++;
                }
                if (widget['h'] === undefined || widget['h'] === null) {
                  const minH = widget['minH'];
                  const baseH = minH ? minH : 2;
                  widget['h'] = baseH;
                  dimensionUpdatedCount++;
                }
              }
            }
          }
        }
      }
      if (updatedWidgetCount) {
        this.pushMsg(`[Upgrade] Updated ${updatedWidgetCount} widget selector(s) to 'widget-host2'.`);
      }
      if (dimensionUpdatedCount) {
        this.pushMsg(`[Upgrade] Doubled widget grid metrics for ${dimensionUpdatedCount} non-zero (w/h/x/y) entries.`);
      }

      config.app.configVersion = 12;

      return {
        app: config.app, theme: config.theme, dashboards: config.dashboards
      };

    } catch (error) {
      this.pushError(`[Upgrade Service] Error upgrading ${config.app.configVersion}: ${(error as Error).message}`);
      return null;
    }
  }

  private migrateUseNeedleToEnableNeedle(dashboards: Dashboard[]): void {
    if (!Array.isArray(dashboards)) return;
    interface WidgetHost2 { input?: { widgetProperties?: { config?: unknown } } }
    interface GaugeCfg { enableNeedle?: boolean; useNeedle?: boolean;[k: string]: unknown }
    let updatedCount = 0;
    for (const dash of dashboards) {
      if (!dash || !Array.isArray(dash.configuration)) continue;
      for (const w of dash.configuration) {
        const widget = w as WidgetHost2;
        const config = widget.input?.widgetProperties?.config as { gauge?: GaugeCfg } | undefined;
        const gauge = config?.gauge;
        if (!gauge || typeof gauge !== 'object') continue;
        if (Object.prototype.hasOwnProperty.call(gauge, 'useNeedle')) {
          if (gauge.enableNeedle === undefined) {
            gauge.enableNeedle = Boolean(gauge.useNeedle);
          } else {
            gauge.enableNeedle = Boolean(gauge.enableNeedle);
          }
          delete gauge.useNeedle;
          updatedCount++;
        }
      }
    }
    if (updatedCount) this.pushMsg(`[Upgrade] Renamed gauge.useNeedle -> gauge.enableNeedle on ${updatedCount} widget(s).`);
  }

  private addSplitShellConfigKeys(app: IAppConfig): void {
    if (!app) return;
    if (app.splitShellEnabled === undefined) app.splitShellEnabled = false;
    if (app.splitShellSide === undefined) app.splitShellSide = "left";
    if (app.splitShellWidth === undefined) app.splitShellWidth = 0.2;
    if (app.splitShellSwipeDisabled === undefined) app.splitShellSwipeDisabled = false;
  }

  private upgradeDashboardWidgets(dashboards: Dashboard[]): void {
    // Iterate dashboards:
    // 1. Force widget selector to 'widget-host2'
    // 2. Double grid metrics (x,y,w,h) if non-zero (leave zeros untouched)
    let selectorUpdatedCount = 0;
    let dimensionUpdatedCount = 0;
    if (Array.isArray(dashboards)) {
      for (const dash of dashboards) {
        if (!dash || !Array.isArray(dash.configuration)) continue;
        for (const widget of dash.configuration) {
          if (!widget || typeof widget !== 'object') continue;

          // Ensure selector
          if (widget.selector !== 'widget-host2') {
            widget.selector = 'widget-host2';
            selectorUpdatedCount++;
          }

          // Helper to safely double a numeric property if > 0 (handles undefined and numeric strings)
          const maybeDouble = (prop: string) => {
            const raw = widget[prop] as unknown;
            const numVal = typeof raw === 'string' ? Number(raw) : (raw as number);
            if (Number.isFinite(numVal) && numVal !== 0) {
              widget[prop] = numVal * 2;
              dimensionUpdatedCount++;
            }
          };
          maybeDouble('w');
          maybeDouble('h');
          maybeDouble('x');
          maybeDouble('y');

          // If width/height were missing, add them using minW/minH (or 2) and scale to new grid (x2)
          if (widget['w'] === undefined || widget['w'] === null) {
            const minWRaw = widget['minW'] as unknown;
            const minW = typeof minWRaw === 'string' ? Number(minWRaw) : (minWRaw as number);
            const baseW = Number.isFinite(minW) && minW! > 0 ? (minW as number) : 2;
            widget['w'] = baseW * 2;
            dimensionUpdatedCount++;
          }
          if (widget['h'] === undefined || widget['h'] === null) {
            const minHRaw = widget['minH'] as unknown;
            const minH = typeof minHRaw === 'string' ? Number(minHRaw) : (minHRaw as number);
            const baseH = Number.isFinite(minH) && minH! > 0 ? (minH as number) : 2;
            widget['h'] = baseH * 2;
            dimensionUpdatedCount++;
          }
        }
      }
    }
    if (selectorUpdatedCount) {
      this.pushMsg(`[Upgrade] Updated ${selectorUpdatedCount} localStorage widget selector(s) to 'widget-host2'.`);
    }
    if (dimensionUpdatedCount) {
      this.pushMsg(`[Upgrade] Doubled grid metrics for ${dimensionUpdatedCount} non-zero (w/h/x/y) entries.`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractWidgetsFromSplitSets(splitSets: any[], widgets: any[], rootSplitUUID: string): NgGridStackWidget[] {
    const widgetMap = new Map(widgets.map(widget => [widget.uuid, widget]));
    const extractedWidgets: NgGridStackWidget[] = [];
    const issues: string[] = [];
    let x = 0; let y = 0; // grid cursor
    const gridWidth = 24; const gridHeight = 24; const widgetWidth = 3; const widgetHeight = 3;
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
    this.pushMsg(msg);
  }
}
