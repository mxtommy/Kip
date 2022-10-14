import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, Validators }    from '@angular/forms';

import { AppSettingsService } from '../app-settings.service';
import { SignalKService } from '../signalk.service';
import { SignalKConnectionService } from '../signalk-connection.service';
import { NotificationsService } from '../notifications.service';
import { IAppConfig, IConnectionConfig, ILayoutConfig, IThemeConfig, IZonesConfig, IWidgetConfig } from '../app-settings.interfaces';

interface possibleConfig {
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
  possibleConfigs: possibleConfig[] = [];

  configName: string = null;
  //configName = new FormControl("default", [ Validators.required, Validators.pattern("^[a-zA-Z0-9\-_]+$") ]);
  configScope = new FormControl("global", Validators.required);
  configLoad = new FormControl(Validators.required);

  serverSupportSaveSub: Subscription;

  constructor(
    private appSettingsService: AppSettingsService,
    private signalKService: SignalKService,
    private signalKConnectionService: SignalKConnectionService,
    private notificationsService: NotificationsService,
  ) { }

  //TODO: fix successful snackbar msg on save error (see console log when not admin user and save to Global scope)
  ngOnInit() {
    this.serverSupportSaveSub = this.signalKService.getServerSupportApplicationDataAsO().subscribe(supported => {
      this.supportApplicationData = supported;
      if (supported) {
        this.getPossibleConfigs();
      }
    });

    this.appJSONConfig = JSON.stringify(this.appSettingsService.getAppConfig(), null, 2);
    this.connectionJSONConfig = JSON.stringify(this.appSettingsService.getConnectionConfig(), null, 2);
    this.widgetJSONConfig = JSON.stringify(this.appSettingsService.getWidgetConfig(), null, 2);
    this.layoutJSONConfig = JSON.stringify(this.appSettingsService.getLayoutConfig(), null, 2);
    this.themeJSONConfig = JSON.stringify(this.appSettingsService.getThemeConfig(), null, 2);
    this.zonesJSONConfig = JSON.stringify(this.appSettingsService.getZonesConfig(), null, 2);
  }

  private getPossibleConfigs() {
    this.possibleConfigs = [];
    this.signalKConnectionService.getApplicationDataKeys('global').subscribe(configNames => {
      for(let cname of configNames) {
        this.possibleConfigs.push({ scope: 'global', name: cname });
      }
    });
    this.signalKConnectionService.getApplicationDataKeys('user').subscribe(configNames => {
      for(let cname of configNames) {
        this.possibleConfigs.push({ scope: 'user', name: cname });
      }
    });
  }

  public saveServerSettings() {
    let allConfig = {};
    allConfig['app'] = this.appSettingsService.getAppConfig();
    allConfig['connection'] = this.appSettingsService.getConnectionConfig();
    allConfig['widget'] = this.appSettingsService.getWidgetConfig();
    allConfig['layout'] = this.appSettingsService.getLayoutConfig();
    allConfig['theme'] = this.appSettingsService.getThemeConfig();
    allConfig['zones'] = this.appSettingsService.getZonesConfig();


    this.signalKConnectionService.postApplicationData(this.configScope.value, this.configName, allConfig).subscribe(result => {
      this.notificationsService.sendSnackbarNotification("Configuration saved to SignalK server", 3000, false);
    });
  }

  public loadServerSettings() {
    this.signalKConnectionService.getApplicationData(this.configLoad.value.scope, this.configLoad.value.name).subscribe(newConfig => {
      let app: IAppConfig = newConfig['app'];
      let connection: IConnectionConfig = newConfig['connection'];
      let widget: IWidgetConfig = newConfig['widget'];
      let layout: ILayoutConfig = newConfig['layout'];
      let theme: IThemeConfig = newConfig['theme'];
      let zones: IZonesConfig = newConfig['zones'] || [];

      // preserve kip uuid
      connection.kipUUID = this.appSettingsService.getKipUUID();

      this.appSettingsService.replaceConfig("appConfig", JSON.stringify(app), false);
      this.appSettingsService.replaceConfig("connectionConfig", JSON.stringify(connection), false);
      this.appSettingsService.replaceConfig("widgetConfig", JSON.stringify(widget), false);
      this.appSettingsService.replaceConfig("layoutConfig", JSON.stringify(layout), false);
      this.appSettingsService.replaceConfig("themeConfig", JSON.stringify(theme), false);
      this.appSettingsService.replaceConfig("zonesConfig", JSON.stringify(zones), true);

    });


  }

  public resetSettings() {
    this.appSettingsService.resetSettings();
  }

  public submitConfig(configType: string) {
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
    this.serverSupportSaveSub.unsubscribe();
  }

}
