import { cloneDeep } from 'lodash-es';
import { Component, inject } from '@angular/core';
import { StorageService, Config } from '../../services/storage.service';
import { IAppConfig, IConfig, IThemeConfig } from '../../interfaces/app-settings.interfaces';
import { v10IConfig, v10IThemeConfig } from './v10-config-interface';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import { MatButtonModule } from '@angular/material/button';
import { AppSettingsService } from '../../services/app-settings.service';
import { Dashboard } from '../../services/dashboard.service';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'upgrade-config',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './upgrade-config.component.html',
  styleUrl: './upgrade-config.component.scss'
})
export class UpgradeConfigComponent {
  protected dialogRef = inject<MatDialogRef<UpgradeConfigComponent>>(MatDialogRef);
  private readonly fileVersionToUpgrade = 9;
  private readonly configVersionToUpgrade = 10;
  private readonly currentConfigVersion = 11;
  private _storage = inject(StorageService);
  private _settings = inject(AppSettingsService);

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

  protected upgrade(): void {
    if (this._storage.initConfig) {
      this._storage.listConfigs(this.fileVersionToUpgrade)
      .then(async (rootConfigs: Config[]) => {
        for (const rootConfig of rootConfigs) {
          const transformedConfig = await this.transformConfig(rootConfig);

          // Skip the loop iteration if transformedConfig is null
          if (!transformedConfig) {
            continue; // Skip to the next iteration
          }

          if (transformedConfig.scope === 'global') {
            try {
              this._storage.patchGlobal(transformedConfig.name, transformedConfig.scope, transformedConfig.newConfiguration, 'add')
              this._storage.patchGlobal(transformedConfig.name, transformedConfig.scope, transformedConfig.oldConfiguration, 'replace', 9);
              console.log(`[Upgrade] Configuration ${transformedConfig.scope}/${transformedConfig.name} has been upgraded to version ${this.currentConfigVersion} and saved. Old configuration has been patched to version 0.`);
            } catch {
              console.error(`[Upgrade] Error saving configuration for ${rootConfig.name}`);
            }

          } else {
            this._storage.setConfig(transformedConfig.scope, transformedConfig.name, transformedConfig.newConfiguration)
            .then(() => {
              this._storage.setConfig(transformedConfig.scope, transformedConfig.name, transformedConfig.oldConfiguration, 9);
              console.log(`[Upgrade] Configuration ${transformedConfig.scope}/${transformedConfig.name} has been upgraded to version ${this.currentConfigVersion} and saved. Old configuration has been patched to version 0.`);
            })
            .catch((error) => {
              console.error(`[Upgrade] Error saving configuration for ${rootConfig.name}:`, error);
            });
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching configuration data:', error);
      });

    } else {
      const localStorageConfig: v10IConfig = {
        app: null,
        widget: null,
        layout: null,
        theme: null
      };
      localStorageConfig.app =  this._settings.loadConfigFromLocalStorage("appConfig");
      localStorageConfig.widget = this._settings.loadConfigFromLocalStorage("widgetConfig");
      localStorageConfig.layout = this._settings.loadConfigFromLocalStorage("layoutConfig");
      localStorageConfig.theme = this._settings.loadConfigFromLocalStorage("themeConfig");

      // Transform app
      const transformedApp = this.transformApp(localStorageConfig.app as IAppConfig);

      // Transform theme
      const transformedTheme = this.transformTheme(localStorageConfig.theme);

      // Transform dashboards and widgets
      const rootSplits = localStorageConfig.layout?.rootSplits || [];
      const splitSets = localStorageConfig.layout?.splitSets || [];
      const widgets = localStorageConfig.widget?.widgets || [];

      const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
        const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);

        return {
          id: rootSplitUUID,
          name: `Dashboard ${i + 1}`,
          configuration
        };
      });

      localStorage.setItem("appConfig", JSON.stringify(transformedApp));
      localStorage.setItem("dashboardsConfig", JSON.stringify(dashboards));
      localStorage.setItem("themeConfig", JSON.stringify(transformedTheme));
    }
    setTimeout(() => {
      this._settings.reloadApp()
    }, 1500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async transformConfig(rootConfig: Config): Promise<any> {
    const config = await this._storage.getConfig(rootConfig.scope, rootConfig.name, this.fileVersionToUpgrade) as unknown as v10IConfig;
    if (config.app.configVersion !== this.configVersionToUpgrade) {
      console.error(`[Upgrade Component] Configuration ${rootConfig.scope}/${rootConfig.name} is not an upgradable version ${this.configVersionToUpgrade} config. Skipping upgrade. Please delete old configuration files.`);
      return null;
    }

    // Transform app
    const transformedApp = this.transformApp(config.app as IAppConfig);

    // Transform theme
    const transformedTheme = this.transformTheme(config.theme);

    // Transform dashboards and widgets
    const rootSplits = config.layout?.rootSplits || [];
    const splitSets = config.layout?.splitSets || [];
    const widgets = config.widget?.widgets || [];

    const dashboards: Dashboard[] = rootSplits.map((rootSplitUUID: string, i: number) => {
      const configuration = this.extractWidgetsFromSplitSets(splitSets, widgets, rootSplitUUID);

      return {
        id: rootSplitUUID,
        name: `Dashboard ${i + 1}`,
        configuration
      };
    });

    const oldConf: v10IConfig = cloneDeep(config);
    oldConf.app.configVersion = 0; // Reset the config version to 0

    return {
      scope: rootConfig.scope,
      name: rootConfig.name,
      newConfiguration: {
        app: transformedApp,
        theme: transformedTheme,
        dashboards: dashboards
      },
      oldConfiguration: oldConf
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformWidget(config: any, widgetType: string): any {
    // Rule 1: Change "color" property value from "white" to "contrast"
    if (config.color === "white") {
      config.color = "contrast";
    }

    // Rule 2: Replace "textColor" with "color" and transform its value
    if (config.textColor) {
      switch (config.textColor) {
        case "text":
          config.color = "contrast";
          break;
        case "primary":
          config.color = "blue";
          break;
        case "accent":
          config.color = "yellow";
          break;
        case "warn":
          config.color = "purple";
          break;
        case "nobar":
          if (widgetType === "WidgetGaugeNgLinearComponent") {
            config.color = "blue"; // Set color to blue
            config.gauge = config.gauge || {}; // Ensure gauge object exists
            config.gauge.useNeedle = false; // Add useNeedle: false
          }
          break;
        default:
          config.color = config.textColor; // Retain the original value if no match
      }
      delete config.textColor; // Remove the "textColor" property
    }

    // Add other transformations here if needed
    return config;
  };

  private transformApp(app: IAppConfig): IAppConfig {
    if (!app) return null;
    app.configVersion = 11; // Update the config version
    app.nightModeBrightness = 0.27;
    return app;
  }

  private transformTheme(theme: v10IThemeConfig): IThemeConfig {
    if (!theme) return null;
    const themeConfig: IThemeConfig = {
      themeName: ''
    };
    return themeConfig;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractWidgetsFromSplitSets(splitSets: any[], widgets: any[], rootSplitUUID: string): NgGridStackWidget[] {
    const widgetMap = new Map(widgets.map(widget => [widget.uuid, widget])); // Map widgets by UUID
    const extractedWidgets: NgGridStackWidget[] = [];
    const issues: string[] = [];

    // Grid layout tracking
    let x = 0; // Current x position
    let y = 0; // Current y position
    const gridWidth = 12; // Grid width
    const gridHeight = 12; // Grid height
    const widgetWidth = 2; // Widget width
    const widgetHeight = 2; // Widget height

    const traverseSplitSets = (splitSetUUID: string) => {
      const splitSet = splitSets.find(set => set.uuid === splitSetUUID);
      if (!splitSet) {
        issues.push(`Missing splitSet with UUID: ${splitSetUUID}`);
        return;
      }

      splitSet.splitAreas.forEach(area => {
        if (area.type === 'widget') {
          const widget = widgetMap.get(area.uuid);
          if (widget) {
            // Skip widgets of type WidgetBlank
            if (widget.type === 'WidgetBlank') {
              console.warn(`Skipping widget of type WidgetBlank with UUID: ${widget.uuid}`);
              return;
            }

            // Check if there is space in the grid
            if (y + widgetHeight > gridHeight) {
              issues.push(`No space left in the grid for widget with UUID: ${widget.uuid}`);
              return; // Skip this widget
            }

            // Map old widget.type to new selector
            const selector = UpgradeConfigComponent.widgetTypeToSelectorMap[widget.type] || 'widget-unknown';

            // Transform the config object using the standalone transformWidget method
            const transformedConfig = this.transformWidget(widget.config, widget.type);

            // Add the widget to the extractedWidgets array
            extractedWidgets.push({
              id: widget.uuid,
              selector: "widget-host2",
              input: {
                widgetProperties: {
                  type: selector, // Widget type mapping
                  uuid: widget.uuid, // Same as the widget ID
                  config: transformedConfig // Transformed config
                }
              },
              x: x, // Current x position
              y: y, // Current y position
              w: widgetWidth, // Widget width
              h: widgetHeight // Widget height
            });

            // Update grid position
            x += widgetWidth;
            if (x >= gridWidth) {
              x = 0; // Reset x to the start of the next row
              y += widgetHeight;
            }
          } else {
            issues.push(`Missing widget with UUID: ${area.uuid}`);
          }
        } else if (area.type === 'splitSet') {
          traverseSplitSets(area.uuid); // Recursively traverse child splitSets
        }
      });
    };

    traverseSplitSets(rootSplitUUID);

    if (issues.length > 0) {
      console.warn('Transformation Issues:', issues);
    }

    return extractedWidgets;
  }

  protected startFresh(): void {
    if (this._storage.initConfig) {
      this._storage.listConfigs(this.fileVersionToUpgrade).then(async (rootConfigs: Config[]) => {
        for (const rootConfig of rootConfigs) {
          const oldConfiguration = await this._storage.getConfig(rootConfig.scope, rootConfig.name, this.fileVersionToUpgrade) as unknown as IConfig;

          oldConfiguration.app.configVersion = 0; // Reset the config version to 0

          if (rootConfig.scope === 'global') {
            try {
              setTimeout(() => {
                this._storage.patchGlobal(rootConfig.name, rootConfig.scope, oldConfiguration, 'replace', 9);
                console.log(`[Retired] Configuration ${rootConfig.scope}/${rootConfig.name} has been patched to version 0.`);
              }, 750);
            } catch {
              console.error(`[Upgrade] Error saving configuration for ${rootConfig.name}:`);
            }

          } else {
            try {
              await this._storage.setConfig(rootConfig.scope, rootConfig.name, oldConfiguration, 9);
              console.log(`[Retired] Configuration ${rootConfig.scope}/${rootConfig.name} has been patched to version 0.`);
            } catch {
                console.error(`[Upgrade] Error saving configuration for ${rootConfig.name}.`);
            }
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching configuration data:', error);
      });

    } else {
      const localStorageConfig: IConfig = {
        app: null,
        dashboards: null,
        theme: null
      };
      localStorageConfig.app =  this._settings.loadConfigFromLocalStorage("appConfig");
      localStorageConfig.theme = this._settings.loadConfigFromLocalStorage("themeConfig");
      localStorageConfig.app.configVersion = 11;
      localStorageConfig.app.nightModeBrightness = 0.27;
      localStorageConfig.theme.themeName = '';
      localStorage.setItem("appConfig", JSON.stringify(localStorageConfig.app));
      localStorage.setItem("themeConfig", JSON.stringify(localStorageConfig.theme));
      localStorage.removeItem("widgetConfig");
      localStorage.removeItem("layoutConfig");
    }
    this.dialogRef.close();
  }
}
