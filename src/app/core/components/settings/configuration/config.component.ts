import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule }    from '@angular/forms';

import { AuthenticationService, IAuthorizationToken } from '../../../services/authentication.service';
import { AppService } from '../../../services/app-service';
import { AppSettingsService } from '../../../services/app-settings.service';
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

@Component({
    selector: 'settings-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    imports: [RouterLink, FormsModule, MatDivider, MatButton, MatFormField, MatLabel, MatSelect, MatOption, MatInput, ReactiveFormsModule, MatInputModule]
})
export class SettingsConfigComponent implements OnInit, OnDestroy {
  private appSettingsService = inject(AppSettingsService);
  private storageSvc = inject(StorageService);
  private appService = inject(AppService);
  private auth = inject(AuthenticationService);
  private fb = inject(UntypedFormBuilder);

  protected readonly pageTitle: string = "Configurations";
  public hasToken = false;
  public isTokenTypeDevice = false;
  private tokenSub: Subscription;

  public supportApplicationData = false;
  public serverConfigList: IRemoteConfig[] = [];
  public serverUpgradableConfigList: IRemoteConfig[] = [];

  public copyConfigForm: UntypedFormGroup;
  public storageLocation: string = null;
  public locations: string[] = ["Local Storage", "Server Storage"];

  public saveConfigName: string = null;
  public saveConfigScope: string = null;
  public deleteConfigItem: IRemoteConfig;
  public jsonData: IConfig = null;

  ngOnInit() {
    // Token observer
    this.tokenSub = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      if (token && token.token) {
        this.hasToken = true;
        this.isTokenTypeDevice = token.isDeviceAccessToken;
        if (!token.isDeviceAccessToken) {
          this.saveConfigScope ='user';
        } else {
          this.saveConfigScope ='global';
        }
      } else {
        this.hasToken = false;
      }
    });

    this.copyConfigForm = this.fb.group({
      sourceTarget: [{value: '', disabled: false}, Validators.required]
    });

    this.supportApplicationData = this.storageSvc.isAppDataSupported;
    if(this.hasToken) this.getServerConfigList();
    // this.getServerConfigList(1); // See if we have v 1.0.0.json file for upgrade
  }

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
          this.serverConfigList = filteredConfigs;
        }
      })
      .catch((error: HttpErrorResponse) => {
        switch (error.status) {
          case 401:
            this.appService.sendSnackbarNotification("Application Storage Error: " + error.statusText + ". Signal K configuration must meet the following requirements; 1) Security enabled. 2) Application Data Storage Interface: On. 3) Either Allow Readonly Access enabled, or connecting with a user.", 0, false);
            break;

          default: this.appService.sendSnackbarNotification("Error listing server configurations: " + error, 3000, false);
            break;
        }
      });
    }
  }

  public saveConfig(conf: IConfig, scope: string, name: string, dontRefreshConfigList?: boolean, forceSave?: boolean) {
    if (this.supportApplicationData) {
      // Prevent saving with scope 'user' and name 'default'
      if ((scope === 'user' && name === 'default') && !forceSave) {
        this.appService.sendSnackbarNotification("Saving configuration with scope 'user' and name 'default' is not allowed.", 5000, false);
        return;
      }

      if (this.storageSvc.setConfig(scope, name, conf)) {
        this.appService.sendSnackbarNotification(`Configuration [${name}] saved to [${scope}] storage scope`, 5000, false);
        if (!dontRefreshConfigList || undefined) {
          this.getServerConfigList();
        }
      } else {
        this.appService.sendSnackbarNotification("Error saving configuration to server", 0, false);
      }
    }
  }

  /**
   * Save config to local storage
   */
  public saveToLocalstorage(config: IConfig) {
    this.appSettingsService.replaceConfig("appConfig", config.app, false);
    this.appSettingsService.replaceConfig("dashboardsConfig", config.dashboards, false);
    this.appSettingsService.replaceConfig("themeConfig", config.theme, false);
  }

  public async copyConfig() {
    let conf: IConfig = null;
    try {
      await this.storageSvc.getConfig(this.copyConfigForm.value.sourceTarget.scope, this.copyConfigForm.value.sourceTarget.name)
      .then((config: IConfig) => {
        conf = config
      });
    } catch (error) {
      this.appService.sendSnackbarNotification("Error retrieving configuration from server: " + error.statusText, 3000, false);
      return;
    }

    this.saveConfig(conf, 'user', 'default', false, true);
    this.appSettingsService.reloadApp();
  }

  public deleteConfig (scope: string, name: string, forceConfigFileVersion?: number, dontRefreshConfigList?: boolean) {
    this.storageSvc.removeItem(scope, name, forceConfigFileVersion);
    this.appService.sendSnackbarNotification(`Configuration [${name}] deleted from [${scope}] storage scope`, 5000, false);
    if (!dontRefreshConfigList) {
      this.getServerConfigList();
    }
  }

  public resetConfigToDefault() {
    this.appSettingsService.resetSettings();
  }

  public resetConnectionToDefault() {
    this.appSettingsService.resetConnection();
  }

  public loadDemoConfig() {
    this.appSettingsService.loadDemoConfig();
  }

  public getActiveConfig(): IConfig {
    let conf: IConfig;
    if (this.appSettingsService.useSharedConfig) {
      conf = this.getLocalConfigFromMemory();
    } else {
      conf = this.getLocalConfigFromLocalStorage();
    }
    return conf;
  }

  public getLocalConfigFromMemory(): IConfig {
    const localConfig: IConfig = {
      "app": this.appSettingsService.getAppConfig(),
      "dashboards": this.appSettingsService.getDashboardConfig(),
      "theme": this.appSettingsService.getThemeConfig(),
    };
    return localConfig;
  }

  public getLocalConfigFromLocalStorage(): IConfig {
    const localConfig: IConfig = {
      "app": this.appSettingsService.loadConfigFromLocalStorage('appConfig'),
      "dashboards": this.appSettingsService.loadConfigFromLocalStorage('dashboardsConfig'),
      "theme": this.appSettingsService.loadConfigFromLocalStorage('themeConfig'),
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
          this.appSettingsService.reloadApp();
        } catch (error) {
          this.appService.sendSnackbarNotification("Invalid JSON file", 3000, false);
          console.error("Invalid JSON file:", error);
        }
      };
      reader.readAsText(file); // Read the file as text
    } else {
      this.appService.sendSnackbarNotification("Please select a valid JSON file", 0, false);
    }
  }

  ngOnDestroy() {
    this.tokenSub.unsubscribe();
  }
}
