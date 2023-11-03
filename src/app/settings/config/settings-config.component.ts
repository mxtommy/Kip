import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup, FormControl, Validators, NgForm }    from '@angular/forms';

import { AuththeticationService, IAuthorizationToken } from './../auththetication.service';
import { AppSettingsService } from '../app-settings.service';
import { IConfig, IAppConfig, IConnectionConfig, IWidgetConfig, ILayoutConfig, IThemeConfig, IZonesConfig } from './../app-settings.interfaces';
import { NotificationsService } from '../notifications.service';
import { StorageService } from './../storage.service';

interface IRemoteConfig {
  scope: string,
  name: string
}

@Component({
  selector: 'app-settings-config',
  templateUrl: './settings-config.component.html',
  styleUrls: ['./settings-config.component.scss']
})
export class SettingsConfigComponent implements OnInit, OnDestroy{

  public hasToken: boolean = false;
  public isTokenTypeDevice: boolean = false;
  private tokenSub: Subscription;

  public supportApplicationData: boolean = false;
  public serverConfigList: IRemoteConfig[] = [];

  public copyConfigForm: FormGroup;
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
    private fb: FormBuilder,
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
  }

  public getServerConfigList() {
    if (this.supportApplicationData) {
      this.storageSvc.listConfigs()
      .then((configs) => {
        this.serverConfigList = configs;
      })
      .catch(error => {
        this.notificationsService.sendSnackbarNotification("Error listing server configurations: " + error, 3000, false);
      });
    }
  }

  public saveConfig(conf: IConfig, scope: string, name: string) {
    if (this.supportApplicationData) { // TOD: add to form to block display
      if (this.storageSvc.setConfig(scope, name, conf)) {
        this.notificationsService.sendSnackbarNotification(`Configuration [${name}] saved to [${scope}] storage scope`, 5000, false);
        this.getServerConfigList();
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

  public deleteConfig (scope: string, name: string) {
    this.storageSvc.removeItem(scope, name);
    this.getServerConfigList();
    this.notificationsService.sendSnackbarNotification(`Configuration [${name}] deleted from [${scope}] storage scope`, 5000, false);
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
