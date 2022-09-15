import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, Validators }    from '@angular/forms';

import { AppSettingsService, IAppConfig, IWidgetConfig, ILayoutConfig, IThemeConfig, IZonesConfig } from '../app-settings.service';
import { SignalKService } from '../signalk.service';
import { SignalKConnectionService } from '../signalk-connection.service';
import { NotificationsService } from '../notifications.service';

interface possibleConfig {
  name: string
  scope: string
}

@Component({
  selector: 'app-settings-config',
  templateUrl: './settings-config.component.html',
  styleUrls: ['./settings-config.component.css']
})
export class SettingsConfigComponent implements OnInit {

  appJSONConfig: string = '';
  widgetJSONConfig: string = '';
  layoutJSONConfig: string = '';
  themeJSONConfig: string = '';
  zonesJSONConfig: string = '';

  hasToken: boolean = false;
  supportApplicationData: boolean = false;
  possibleConfigs: possibleConfig[] = [];

  configName = new FormControl("default", [ Validators.required, Validators.pattern("^[a-zA-Z0-9\-_]+$") ]);
  configScope = new FormControl("global", Validators.required);
  configLoad = new FormControl(Validators.required);


  authTokenSub: Subscription;
  serverSupportSaveSub: Subscription;

  constructor(
    private AppSettingsService: AppSettingsService,
    private SignalKService: SignalKService,
    private SignalKConnectionService: SignalKConnectionService,
    private NotificationsService: NotificationsService,
  ) { }


  ngOnInit() {
    this.serverSupportSaveSub = this.SignalKService.getServerSupportApplicationDataAsO().subscribe(supported => {
      this.supportApplicationData = supported;
      if (supported) {
        this.getPossibleConfigs();
      }
    });

    this.appJSONConfig = JSON.stringify(this.AppSettingsService.getAppConfig(), null, 2);
    this.widgetJSONConfig = JSON.stringify(this.AppSettingsService.getWidgetConfig(), null, 2);
    this.layoutJSONConfig = JSON.stringify(this.AppSettingsService.getLayoutConfig(), null, 2);
    this.themeJSONConfig = JSON.stringify(this.AppSettingsService.getThemeConfig(), null, 2);
    this.zonesJSONConfig = JSON.stringify(this.AppSettingsService.getZonesConfig(), null, 2);
  }

  private getPossibleConfigs() {
    this.possibleConfigs = [];
    this.SignalKConnectionService.getApplicationDataKeys('global').subscribe(configNames => {
      for(let cname of configNames) {
        this.possibleConfigs.push({ scope: 'global', name: cname });
      }
    });
    this.SignalKConnectionService.getApplicationDataKeys('user').subscribe(configNames => {
      for(let cname of configNames) {
        this.possibleConfigs.push({ scope: 'user', name: cname });
      }
    });
  }

  saveServerSettings() {
    let allConfig = {};
    allConfig['app'] = this.AppSettingsService.getAppConfig();
    allConfig['widget'] = this.AppSettingsService.getWidgetConfig();
    allConfig['layout'] = this.AppSettingsService.getLayoutConfig();
    allConfig['theme'] = this.AppSettingsService.getThemeConfig();
    allConfig['zones'] = this.AppSettingsService.getZonesConfig();


    this.SignalKConnectionService.postApplicationData(this.configScope.value, this.configName.value, allConfig).subscribe(result => {
      this.NotificationsService.sendSnackbarNotification("Configuration saved to SignalK server", 3000);
    });
  }

  loadServerSettings() {
    this.SignalKConnectionService.getApplicationData(this.configLoad.value.scope, this.configLoad.value.name).subscribe(newConfig => {
      let app: IAppConfig = newConfig['app'];
      let widget: IWidgetConfig = newConfig['widget'];
      let layout: ILayoutConfig = newConfig['layout'];
      let theme: IThemeConfig = newConfig['theme'];
      let zones: IZonesConfig = newConfig['zones'] || [];

      // preserve kip uuid
      app.kipUUID = this.AppSettingsService.getKipUUID();

      this.AppSettingsService.replaceConfig("appConfig", JSON.stringify(app), false);
      this.AppSettingsService.replaceConfig("widgetConfig", JSON.stringify(widget), false);
      this.AppSettingsService.replaceConfig("layoutConfig", JSON.stringify(layout), false);
      this.AppSettingsService.replaceConfig("themeConfig", JSON.stringify(theme), false);
      this.AppSettingsService.replaceConfig("zonesConfig", JSON.stringify(zones), true);

    });


  }

  resetSettings() {
    this.AppSettingsService.resetSettings();
  }

  submitConfig(configType: string) {
    switch (configType) {
      case "appConfig":
        this.AppSettingsService.replaceConfig(configType, this.appJSONConfig, true);
        break;

      case "widgetConfig":
        this.AppSettingsService.replaceConfig(configType, this.widgetJSONConfig, true);
        break;

      case "layoutConfig":
        this.AppSettingsService.replaceConfig(configType, this.layoutJSONConfig, true);
        break;

      case "themeConfig":
        this.AppSettingsService.replaceConfig(configType, this.themeJSONConfig, true);
        break;

      case "zonesConfig":
        console.log(this.zonesJSONConfig);
        this.AppSettingsService.replaceConfig(configType, this.zonesJSONConfig, true);
        break;
    }
  }

  loadDemoConfig() {
    this.AppSettingsService.loadDemoConfig();
  }

  ngOnDestroy() {
    this.serverSupportSaveSub.unsubscribe();
  }

}
