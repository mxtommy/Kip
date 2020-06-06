import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, Validators }    from '@angular/forms';

import { AppSettingsService, IAppConfig, IWidgetConfig, ILayoutConfig, IThemeConfig } from '../app-settings.service';
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

    this.authTokenSub = this.AppSettingsService.getSignalKTokenAsO().subscribe(token => {
      if (token.token) {
        this.hasToken = true;
      } else {
        this.hasToken = false;
      }
    });

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
    const app = this.AppSettingsService.getAppConfig();
    const widget = this.AppSettingsService.getWidgetConfig();
    const layout = this.AppSettingsService.getLayoutConfig();
    const theme = this.AppSettingsService.getThemeConfig();
    const config = Object.assign(app, widget, layout, theme);

    this.SignalKConnectionService.postApplicationData(this.configScope.value, this.configName.value, config).subscribe(result => {
      this.NotificationsService.sendSnackbarNotification("Configuration saved to SignalK server", 3000);
    });
  }

  loadServerSettings() {
    this.SignalKConnectionService.getApplicationData(this.configLoad.value.scope, this.configLoad.value.name).subscribe(newConfig => {
      let app: IAppConfig;
      let widget: IWidgetConfig;
      let layout: ILayoutConfig;
      let theme: IThemeConfig;

      newConfig.forEach(element => {
        switch (element) {
          case "configVersion":
            app.configVersion = element;
            break;

          case "dataSets":
            app.dataSets = element;
            break;

          case "notificationConfig":
            app.notificationConfig = element;
            break;

          case "rootSplits":
            layout.rootSplits = element;
            break;

          case "signalKToken":
            app.signalKToken = element;
            break;

          case "signalKUrl":
            app.signalKUrl = element;
            break;

          case "splitSets":
            layout.splitSets = element;
            break;

          case "themeName":
            theme.themeName = element;
            break;

          case "unitDefaults":
            app.unitDefaults = element;
            break;

          case "unlockStatus":
            app.unlockStatus = element;
            break;

          case "widgets":
            widget.widgets = element;
            break;
        }
        this.AppSettingsService.replaceConfig("appConfig", JSON.stringify(newConfig), false);
        this.AppSettingsService.replaceConfig("widgetConfig", JSON.stringify(newConfig), false);
        this.AppSettingsService.replaceConfig("layoutConfig", JSON.stringify(newConfig), false);
        this.AppSettingsService.replaceConfig("themeConfig", JSON.stringify(newConfig), true);
      });
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
    }
  }

  loadDemoConfig() {
    this.AppSettingsService.loadDemoConfig();
  }

  ngOnDestroy() {
    this.authTokenSub.unsubscribe();
    this.serverSupportSaveSub.unsubscribe();
  }

}
