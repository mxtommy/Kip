import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UntypedFormBuilder, UntypedFormGroup, FormControl, Validators, NgForm }    from '@angular/forms';

import { AuththeticationService, IAuthorizationToken } from '../../auththetication.service';
import { AppSettingsService } from '../../app-settings.service';
import { IConfig, IAppConfig, IConnectionConfig, IWidgetConfig, ILayoutConfig, IThemeConfig, IZonesConfig } from '../../app-settings.interfaces';
import { NotificationsService } from '../../notifications.service';
import { StorageService } from '../../storage.service';
import { cloneDeep, forEach } from 'lodash-es';

interface IRemoteConfig {
  scope: string,
  name: string
}

@Component({
  selector: 'settings-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss']
})
export class SettingsConfigComponent implements OnInit, OnDestroy{

  public hasToken: boolean = false;
  public isTokenTypeDevice: boolean = false;
  private tokenSub: Subscription;

  public supportApplicationData: boolean = false;
  public serverConfigList: IRemoteConfig[] = [];
  public serverUpgradableConfigList: IRemoteConfig[] = [];


  public copyConfigForm: UntypedFormGroup;
  public storageLocation: string = null;
  public locations: string[] = ["Local Storage", "Remote Storage"];

  public saveConfigName: string = null;
  public saveConfigScope: string = null;
  public deleteConfigItem: IRemoteConfig;

  // Raw Editor
  public liveAppConfig: IAppConfig;
  public liveConnectionConfig: IConnectionConfig;
  public liveWidgetConfig: IWidgetConfig;
  public liveLayoutConfig: ILayoutConfig;
  public liveThemeConfig: IThemeConfig;
  public liveZonesConfig: IZonesConfig;
  public showRawEditor = false;

  constructor(
    private appSettingsService: AppSettingsService,
    private storageSvc: StorageService,
    private notificationsService: NotificationsService,
    private auth: AuththeticationService,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnInit() {
    // Token observer
    this.tokenSub = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      if (token && token.token) {
        this.hasToken = true;
        this.isTokenTypeDevice = token.isDeviceAccessToken;
        if (!token.isDeviceAccessToken) {
          this.saveConfigScope ='user';
        } else {
          this.saveConfigScope ='glodal';
        }
      } else {
        this.hasToken = false;
      }
    });

    this.copyConfigForm = this.fb.group({
      copySource: ['', Validators.required],
      sourceTarget: [{value: '', disabled: true}, Validators.required],
      copyDestination: ['', Validators.required],
      destinationTarget: [{value: '', disabled: true}, Validators.required],
    });

    // set control form options
    if (!this.hasToken) {
      let src = this.copyConfigForm.get('copySource');
      src.setValue('Remote Storage');
      src.disable();
      this.copyConfigForm.get('sourceTarget').enable();

      let dest = this.copyConfigForm.get('copyDestination');
      dest.setValue('Local Storage');
      dest.disable();
    }

    this.supportApplicationData = this.storageSvc.isAppDataSupported;
    this.getLiveConfig();
    this.getServerConfigList();
    this.getServerConfigList(1); // See if we have v 1.0.0.json file for upgrade
  }

  public getServerConfigList(configFileVersionName?: number) {
    if (this.supportApplicationData) {
      this.storageSvc.listConfigs(configFileVersionName)
      .then((configs) => {
        // see if we have an old config file
        if(configFileVersionName) {
          this.serverUpgradableConfigList = configs;
        } else {
          this.serverConfigList = configs;
        }
      })
      .catch(error => {
        this.notificationsService.sendSnackbarNotification("Error listing server configurations: " + error, 3000, false);
      });
    }
  }

  public saveConfig(conf: IConfig, scope: string, name: string, dontRefreshConfigList?: boolean) {
    if (this.supportApplicationData) {
      if (this.storageSvc.setConfig(scope, name, conf)) {
        this.notificationsService.sendSnackbarNotification(`Configuration [${name}] saved to [${scope}] storage scope`, 5000, false);
        if (!dontRefreshConfigList) {
          this.getServerConfigList();
        }
      } else {
        this.notificationsService.sendSnackbarNotification("Error saving configuration to server", 0, false);
      }
    }
  }

  public async copyConfig() {
    if (this.copyConfigForm.value.copySource === 'Local Storage') {
      if (this.copyConfigForm.value.copyDestination === 'Remote Storage') {
        // local to remote
        if (this.copyConfigForm.value.destinationTarget.scope === 'user' && this.copyConfigForm.value.destinationTarget.name === 'default' && this.hasToken && !this.isTokenTypeDevice) {
          this.notificationsService.sendSnackbarNotification("Local Storage cannot be copied to [user / default] when Sign in option is enabled. Use another copy source", 0, false);
        } else {
          this.saveConfig(this.getLocalConfig(), this.copyConfigForm.value.destinationTarget.scope, this.copyConfigForm.value.destinationTarget.name);
        }

      } else if(this.copyConfigForm.value.copyDestination === 'Local Storage') {
        // local to local
        this.notificationsService.sendSnackbarNotification("Local Storage cannot be copies to Local Storage ", 0, false);
      }

    } else {
      let conf: IConfig = null;
      try {
        await this.storageSvc.getConfig(this.copyConfigForm.value.sourceTarget.scope, this.copyConfigForm.value.sourceTarget.name)
        .then((config: IConfig) => {
          conf = config
        });
      } catch (error) {
        this.notificationsService.sendSnackbarNotification("Error retreiving configuration from server: " + error.statusText, 3000, false);
        return;
      }

      if (this.copyConfigForm.value.copyDestination === 'Remote Storage') {
        //remote to remote
        this.saveConfig(conf, this.copyConfigForm.value.destinationTarget.scope, this.copyConfigForm.value.destinationTarget.name);
        if (this.copyConfigForm.value.destinationTarget.scope === 'user' && this.copyConfigForm.value.destinationTarget.name === 'default' && this.hasToken && !this.isTokenTypeDevice) {
          this.appSettingsService.reloadApp();
        }
      } else {
        // remote to local
        this.appSettingsService.replaceConfig("appConfig", conf.app, false);
        this.appSettingsService.replaceConfig("widgetConfig", conf.widget, false);
        this.appSettingsService.replaceConfig("layoutConfig", conf.layout, false);
        this.appSettingsService.replaceConfig("themeConfig", conf.theme, false);
        this.appSettingsService.replaceConfig("zonesConfig", conf.zones, true);
      }
    }
  }

  public deleteConfig (scope: string, name: string, forceConfigFileVersion?: number, dontRefreshConfigList?: boolean) {
    this.storageSvc.removeItem(scope, name, forceConfigFileVersion);
    this.notificationsService.sendSnackbarNotification(`Configuration [${name}] deleted from [${scope}] storage scope`, 5000, false);
    if (!dontRefreshConfigList) {
      this.getServerConfigList();
    }
  }

  public upgradeConfig() {
    this.serverUpgradableConfigList.forEach(async (oldConfig:IRemoteConfig, index) => {
      let conf: IConfig = null;
      await this.storageSvc.getConfig(oldConfig.scope, oldConfig.name, 1)
        .then((config: IConfig) => {
          console.log('[Configuration] Upgrading v1 config [' + oldConfig.name + '] from [' + oldConfig.scope + '] scope');
          conf = config
          let upgradedAppConfig: IAppConfig = {
            configVersion: 9,
            autoNightMode: this.appSettingsService.getAutoNightMode(),
            dataSets: cloneDeep(config.app.dataSets),
            notificationConfig: cloneDeep(config.app.notificationConfig),
            unitDefaults: cloneDeep(config.app.unitDefaults)
          };
          conf.app = upgradedAppConfig
        })
        .catch(error => {
          console.error("[Configuration] Error upgrading older configuration: " + error.statusText);
        });

      console.log('[Configuration] Saving upgraded config [' + oldConfig.name + '] to [' + oldConfig.scope + '] scope');
      this.storageSvc.patchGlobal(oldConfig.name, oldConfig.scope, conf, 'add');
    });
    this.notificationsService.sendSnackbarNotification("Configuration migration completed. WARNING: Test the migrated configurations before deleting them.", 0, false);
  }

  public refreshConfig(): void {
    this.storageSvc.listConfigs()
      .then((configs) => {
        this.serverConfigList = configs;
      })
      .catch(error => {
        this.notificationsService.sendSnackbarNotification("[Configuration] Error listing server configurations: " + error, 3000, false);
      });
  }

  public deleteOldConfig(): void {
    this.serverUpgradableConfigList.forEach(oldConfig => {
        console.log('[Configuration] Deleting v1 config [' + oldConfig.name + '] from [' + oldConfig.scope + '] scope');
        this.storageSvc.removeItem(oldConfig.scope, oldConfig.name, 1);

        this.serverUpgradableConfigList = [];
    });
  }

  public rawConfigSave(configType: string) {
    switch (configType) {
      case "IConnectionConfig":
          this.appSettingsService.replaceConfig('connectionConfig', this.liveConnectionConfig, true);
        break;

      case "IAppConfig":
        if (this.hasToken && !this.isTokenTypeDevice) {
          this.storageSvc.patchConfig(configType, this.liveAppConfig);
        } else {
        this.appSettingsService.replaceConfig('appConfig', this.liveAppConfig, true);
        }
        break;

      case "IWidgetConfig":
        if (this.hasToken && !this.isTokenTypeDevice) {
          this.storageSvc.patchConfig(configType, this.liveWidgetConfig);
        } else {
        this.appSettingsService.replaceConfig('widgetConfig', this.liveWidgetConfig, true);
        }
        break;

      case "ILayoutConfig":
        if (this.hasToken && !this.isTokenTypeDevice) {
          this.storageSvc.patchConfig(configType, this.liveLayoutConfig);
        } else {
        this.appSettingsService.replaceConfig('layoutConfig', this.liveLayoutConfig, true);
        }
        break;

      case "IThemeConfig":
        if (this.hasToken && !this.isTokenTypeDevice) {
          this.storageSvc.patchConfig(configType, this.liveThemeConfig);
        } else {
        this.appSettingsService.replaceConfig('themeConfig', this.liveThemeConfig, true);
        }
        break;

      case "IZonesConfig":
        if (this.hasToken && !this.isTokenTypeDevice) {
          this.storageSvc.patchConfig(configType, this.liveZonesConfig);
        } else {
        this.appSettingsService.replaceConfig("zonesConfig", this.liveZonesConfig, true);
        }
        break;
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

  private getLiveConfig(): void {
    this.liveAppConfig = this.appSettingsService.getAppConfig();
    this.liveConnectionConfig = this.appSettingsService.getConnectionConfig();
    this.liveWidgetConfig = this.appSettingsService.getWidgetConfig();
    this.liveLayoutConfig = this.appSettingsService.getLayoutConfig();
    this.liveThemeConfig = this.appSettingsService.getThemeConfig();
    this.liveZonesConfig = this.appSettingsService.getZonesConfig();
  }

  get jsonZonesConfig() {
    return JSON.stringify(this.liveZonesConfig, null, 2);
  }

  set jsonZonesConfig(v) {
    try{
      this.liveZonesConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  get jsonThemeConfig() {
    return JSON.stringify(this.liveThemeConfig, null, 2);
  }

  set jsonThemeConfig(v) {
    try{
      this.liveThemeConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  get jsonLayoutConfig() {
    return JSON.stringify(this.liveLayoutConfig, null, 2);
  }

  set jsonLayoutConfig(v) {
    try{
      this.liveLayoutConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  get jsonWidgetConfig() {
    return JSON.stringify(this.liveWidgetConfig, null, 2);
  }

  set jsonWidgetConfig(v) {
    try{
      this.liveWidgetConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  get jsonAppConfig() {
    return JSON.stringify(this.liveAppConfig, null, 2);
  }

  set jsonAppConfig(v) {
    try{
      this.liveAppConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  get jsonConnectionConfig() {
    return JSON.stringify(this.liveConnectionConfig, null, 2);
  }

  set jsonConnectionConfig(v) {
    try{
      this.liveConnectionConfig = JSON.parse(v);}
    catch(error) {
      console.log(`JSON syntax error: ${error}`);
    };
  }

  public getLocalConfig(): IConfig {
    let localConfig: IConfig = {
      "app": this.appSettingsService.getAppConfig(),
      "widget": this.appSettingsService.getWidgetConfig(),
      "layout": this.appSettingsService.getLayoutConfig(),
      "theme": this.appSettingsService.getThemeConfig(),
      "zones": this.appSettingsService.getZonesConfig(),
    };
    return localConfig;
  }

  public onSourceSelectChange(event): void {
    if (event.value === 'Local Storage') {
      this.copyConfigForm.get('sourceTarget').disable();
    } else {
      this.copyConfigForm.get('sourceTarget').enable();
    }
  }

  public onDestinationSelectChange(event): void {
    if (event.value === 'Local Storage') {
      this.copyConfigForm.get('destinationTarget').disable();
    } else {
      this.copyConfigForm.get('destinationTarget').enable();
    }
  }

  ngOnDestroy() {
    this.tokenSub.unsubscribe();
  }
}
