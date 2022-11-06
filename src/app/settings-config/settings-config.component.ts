import { SignalKDeltaService } from './../signalk-delta.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, Validators }    from '@angular/forms';

import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';
import { StorageService } from './../storage.service';
import { IConfig } from '../app-settings.interfaces';

interface Config {
  name: string
  scope: string
}

@Component({
  selector: 'app-settings-config',
  templateUrl: './settings-config.component.html',
  styleUrls: ['./settings-config.component.css']
})
export class SettingsConfigComponent implements OnInit, OnDestroy{

  appJSONConfig: string = '';
  connectionJSONConfig: string = '';
  widgetJSONConfig: string = '';
  layoutJSONConfig: string = '';
  themeJSONConfig: string = '';
  zonesJSONConfig: string = '';

  hasToken: boolean = false;
  supportApplicationData: boolean = false;
  serverConfigs: Config[] = [];

  configName: string = null;
  configScope = new FormControl("global", Validators.required);
  configLoad = new FormControl(Validators.required);

  constructor(
    private appSettingsService: AppSettingsService,
    private storageSvc: StorageService,
    private deltaService: SignalKDeltaService,
    private notificationsService: NotificationsService,
  ) { }

  //TODO: fix successful snackbar msg on save error (see console log when not admin user and save to Global scope)
  ngOnInit() {

    this.hasToken = this.deltaService.streamEndpoint.hasToken;

    this.supportApplicationData = this.storageSvc.isAppDataSupported;
    this.appJSONConfig = JSON.stringify(this.appSettingsService.getAppConfig(), null, 2);
    this.connectionJSONConfig = JSON.stringify(this.appSettingsService.getConnectionConfig(), null, 2);
    this.widgetJSONConfig = JSON.stringify(this.appSettingsService.getWidgetConfig(), null, 2);
    this.layoutJSONConfig = JSON.stringify(this.appSettingsService.getLayoutConfig(), null, 2);
    this.themeJSONConfig = JSON.stringify(this.appSettingsService.getThemeConfig(), null, 2);
    this.zonesJSONConfig = JSON.stringify(this.appSettingsService.getZonesConfig(), null, 2);

    this.getServerConfigList();
  }

  public getServerConfigList() {
    this.storageSvc.listConfigs()
    .then((configs) => {
      this.serverConfigs = configs;
    })
    .catch(error => {
      this.notificationsService.sendSnackbarNotification("Error listing server configurations: " + error, 3000, false);
    });
  }

  public saveLocalConfigToserver() {
    let localConfig: IConfig = {
      "app": null,
      "widget": null,
      "layout": null,
      "theme": null,
      "zones": null,
    };

    localConfig.app = this.appSettingsService.getAppConfig();
    localConfig.widget = this.appSettingsService.getWidgetConfig();
    localConfig.layout = this.appSettingsService.getLayoutConfig();
    localConfig.theme = this.appSettingsService.getThemeConfig();
    localConfig.zones = this.appSettingsService.getZonesConfig();

    if (this.storageSvc.setConfig(this.configScope.value, this.configName, localConfig)) {
      this.notificationsService.sendSnackbarNotification("Configuration " + this.configName + " saved to server", 3000, false);
      this.getServerConfigList();
    } else {
      this.notificationsService.sendSnackbarNotification("Error saving configuration to server", 3000, false);
    }
  }

  public async restoreRemoteServerConfig() {
    let conf: IConfig = null;
    try {
      await this.storageSvc.getConfig(this.configLoad.value.scope, this.configLoad.value.name)
      .then((config: IConfig) => {
        conf = config
      });
    } catch (error) {
      this.notificationsService.sendSnackbarNotification("Error retreiving configuration from server: " + error.statusText, 3000, false);
    }
    if (conf) {
      this.appSettingsService.replaceConfig("appConfig", JSON.stringify(conf.app), false);
      this.appSettingsService.replaceConfig("widgetConfig", JSON.stringify(conf.widget), false);
      this.appSettingsService.replaceConfig("layoutConfig", JSON.stringify(conf.layout), false);
      this.appSettingsService.replaceConfig("themeConfig", JSON.stringify(conf.theme), false);
      this.appSettingsService.replaceConfig("zonesConfig", JSON.stringify(conf.zones), true);
    }
  }

  public resetConfigToDefault() {
    this.appSettingsService.resetSettings();
  }

  public saveToLocalConfig(configType: string) {
    switch (configType) {
      case "appConfig":
        this.appSettingsService.replaceConfig(configType, this.appJSONConfig, true);
        break;

      case "connectionConfig":
        this.appSettingsService.replaceConfig(configType, this.connectionJSONConfig, true);
        break;

      case "widgetConfig":
        this.appSettingsService.replaceConfig(configType, this.widgetJSONConfig, true);
        break;

      case "layoutConfig":
        this.appSettingsService.replaceConfig(configType, this.layoutJSONConfig, true);
        break;

      case "themeConfig":
        this.appSettingsService.replaceConfig(configType, this.themeJSONConfig, true);
        break;

      case "zonesConfig":
        console.log(this.zonesJSONConfig);
        this.appSettingsService.replaceConfig(configType, this.zonesJSONConfig, true);
        break;
    }
  }

  public loadDemoConfig() {
    this.appSettingsService.loadDemoConfig();
  }

  ngOnDestroy() {
  }

}
