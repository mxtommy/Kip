import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule }    from '@angular/forms';

import { AuthenticationService } from '../../../services/authentication.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { IConfig } from '../../../interfaces/app-settings.interfaces';
import { StorageService } from '../../../services/storage.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { RouterLink } from '@angular/router';

interface IRemoteConfig {
  scope: string,
  name: string
}

interface IRemoteConfigOption extends IRemoteConfig {
  key: string
}

@Component({
    selector: 'settings-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    imports: [RouterLink, FormsModule, MatDivider, MatButton, MatFormField, MatLabel, MatSelect, MatOption, MatInput, ReactiveFormsModule, MatInputModule]
})
export class SettingsConfigComponent {
  private settings = inject(SettingsService);
  private storageSvc = inject(StorageService);
  private toast = inject(ToastService);
  private auth = inject(AuthenticationService);
  private fb = inject(UntypedFormBuilder);

  private authToken = toSignal(this.auth.authToken$, { initialValue: null });
  private serverConfigListSignal = signal<IRemoteConfig[]>([]);
  private hasTokenSignal = computed(() => Boolean(this.authToken()?.token));
  private isTokenTypeDeviceSignal = computed(() => Boolean(this.authToken()?.isDeviceAccessToken));

  protected readonly pageTitle: string = "Configurations";

  public get hasToken(): boolean {
    return this.hasTokenSignal();
  }

  public get isTokenTypeDevice(): boolean {
    return this.isTokenTypeDeviceSignal();
  }

  public supportApplicationData = this.storageSvc.isAppDataSupported;
  public serverConfigOptions = computed<IRemoteConfigOption[]>(() => this.serverConfigListSignal().map((config) => ({
    scope: config.scope,
    name: config.name,
    key: `${config.scope}::${config.name}`
  })));
  public serverUpgradableConfigList: IRemoteConfig[] = [];

  public copyConfigForm: UntypedFormGroup = this.fb.group({
    sourceTarget: [{value: '', disabled: false}, Validators.required]
  });
  public storageLocation: string = null;
  public locations: string[] = ["Local Storage", "Server Storage"];

  public saveConfigName: string = null;
  public saveConfigScope: string = null;
  public deleteConfigKey: string = null;
  public jsonData: IConfig = null;

  private readonly authStateEffect = effect(() => {
    if (!this.supportApplicationData) {
      return;
    }

    if (this.hasTokenSignal()) {
      this.saveConfigScope = this.isTokenTypeDeviceSignal() ? 'global' : 'user';
      this.getServerConfigList();
      return;
    }

    this.deleteConfigKey = null;
  });

  public getServerConfigList(configFileVersionName?: number) {
    if (this.supportApplicationData) {
      this.storageSvc.listConfigs(configFileVersionName)
      .then((configs) => {
        // Filter out entries with scope 'user' and name 'default'
        const filteredConfigs = configs.filter(config => !(config.scope === 'user' && config.name === 'default'));

        // see if we have an old config file
        if(configFileVersionName) {
          this.serverUpgradableConfigList = filteredConfigs;
        } else {
          this.serverConfigListSignal.set(filteredConfigs);
        }
      })
      .catch((error: HttpErrorResponse) => {
        switch (error.status) {
          case 401:
            this.toast.show("Storage Service: " + error.statusText + ". Signal K configuration must meet the following requirements; 1) Security enabled. 2) Application Data Storage Interface: On. 3) Either Allow Readonly Access enabled, or connecting with a user.", 0, false, 'error');
            break;

          default: this.toast.show("Cannot list configurations: " + error, 0, false, 'error' );
            break;
        }
      });
    }
  }

  public saveConfig(conf: IConfig, scope: string, name: string, dontRefreshConfigList?: boolean, forceSave?: boolean) {
    if (this.supportApplicationData) {
      // Prevent saving with scope 'user' and name 'default'
      if ((scope === 'user' && name === 'default') && !forceSave) {
        this.toast.show("Saving configuration with scope 'user' and name 'default' is not allowed.", 0, false, 'error');
        return;
      }

      if (this.storageSvc.setConfig(scope, name, conf)) {
        this.toast.show(`Configuration [${name}] saved to [${scope}] storage scope`, 1000, true, 'success');
        if (!dontRefreshConfigList || undefined) {
          this.getServerConfigList();
        }
      } else {
        this.toast.show("Configuration not saved to server", 0, false, 'error');
      }
    }
  }

  /**
   * Save config to local storage
   */
  public saveToLocalstorage(config: IConfig) {
    this.settings.replaceConfig("appConfig", config.app, false);
    this.settings.replaceConfig("dashboardsConfig", config.dashboards, false);
    this.settings.replaceConfig("themeConfig", config.theme, false);
  }

  public async copyConfig() {
    const sourceTarget = this.parseConfigKey(this.copyConfigForm.value.sourceTarget);
    if (!sourceTarget) {
      this.toast.show('Please select a valid configuration to restore.', 0, false, 'error');
      return;
    }

    let conf: IConfig = null;
    try {
      await this.storageSvc.getConfig(sourceTarget.scope, sourceTarget.name)
      .then((config: IConfig) => {
        conf = config
      });
    } catch (error) {
      this.toast.show("Cannot retrieve server configuration: " + error.statusText, 0, false, 'error');
      return;
    }

    this.saveConfig(conf, 'user', 'default', false, true);
    this.settings.reloadApp();
  }

  public deleteConfigByKey(configKey: string) {
    const config = this.parseConfigKey(configKey);
    if (!config) {
      this.toast.show('Please select a valid configuration to delete.', 0, false, 'error');
      return;
    }

    this.deleteConfig(config.scope, config.name);
  }

  public deleteConfig (scope: string, name: string, forceConfigFileVersion?: number, dontRefreshConfigList?: boolean) {
    this.storageSvc.removeItem(scope, name, forceConfigFileVersion);
    this.toast.show(`Configuration [${name}] deleted from [${scope}] storage scope`, 1000, false, 'success');
    if (!dontRefreshConfigList) {
      this.getServerConfigList();
    }
  }

  private parseConfigKey(configKey: string | null): IRemoteConfig | null {
    if (!configKey) {
      return null;
    }

    const [scope, ...nameParts] = configKey.split('::');
    const name = nameParts.join('::');
    if (!scope || !name) {
      return null;
    }

    return { scope, name };
  }

  public resetConfigToDefault() {
    this.settings.resetSettings();
  }

  public resetConnectionToDefault() {
    this.settings.resetConnection();
  }

  public loadDemoConfig() {
    this.settings.loadDemoConfig();
  }

  public getActiveConfig(): IConfig {
    let conf: IConfig;
    if (this.settings.useSharedConfig) {
      conf = this.getLocalConfigFromMemory();
    } else {
      conf = this.getLocalConfigFromLocalStorage();
    }
    return conf;
  }

  public getLocalConfigFromMemory(): IConfig {
    const localConfig: IConfig = {
      "app": this.settings.getAppConfig(),
      "dashboards": this.settings.getDashboardConfig(),
      "theme": this.settings.getThemeConfig(),
    };
    return localConfig;
  }

  public getLocalConfigFromLocalStorage(): IConfig {
    const localConfig: IConfig = {
      "app": this.settings.loadConfigFromLocalStorage('appConfig'),
      "dashboards": this.settings.loadConfigFromLocalStorage('dashboardsConfig'),
      "theme": this.settings.loadConfigFromLocalStorage('themeConfig'),
    };
    return localConfig;
  }

  public downloadJsonConfig(): void {
    const jsonData = this.getActiveConfig();
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const downloadURL = window.URL.createObjectURL(blob); // Generate a temporary download URL

    // Create an invisible <a> element and trigger the download
    const a = document.createElement('a');
    a.href = downloadURL;
    a.download = 'KipConfig.json'; // File name
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(downloadURL); // Cleanup memory
  }

  public uploadJsonConfig(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          this.jsonData = JSON.parse(e.target?.result as string); // Parse JSON
          if (this.hasToken) {
            this.saveConfig(this.jsonData, 'user', 'default', false, true);
          } else {
            this.saveToLocalstorage(this.jsonData);
          }
          this.settings.reloadApp();
        } catch (error) {
          this.toast.show("File does not contain valid JSON.", 0, false, 'error');
          console.error("Invalid JSON file format:", error);
        }
      };
      reader.readAsText(file); // Read the file as text
    } else {
      this.toast.show("Please select a valid JSON file", 0, false, 'error');
    }
  }

}
