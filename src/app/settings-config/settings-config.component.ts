import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, Validators }    from '@angular/forms';

import { AppSettingsService } from '../app-settings.service';
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

  jsonConfig: string = '';

  applicationConfig: Object;

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

    this.applicationConfig = this.AppSettingsService.getAppConfig();
    this.jsonConfig = JSON.stringify(this.applicationConfig, null, 2);
    this.authTokenSub = this.AppSettingsService.getSignalKTokenAsO().subscribe(token => {
      if (token.token) {
        this.hasToken = true;
      } else {
        this.hasToken = false;
      }
    });

  }

  getPossibleConfigs() {
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

  ngOnDestroy() {
    this.authTokenSub.unsubscribe();
    this.serverSupportSaveSub.unsubscribe();
  }

  saveServerSettings() {
    this.SignalKConnectionService.postApplicationData(this.configScope.value, this.configName.value, this.applicationConfig).subscribe(result => {
      this.NotificationsService.newNotification("Configuration Saved!", 3000);
    });
  }

  loadServerSettings() {
    this.SignalKConnectionService.getApplicationData(this.configLoad.value.scope, this.configLoad.value.name).subscribe(newConfig => {
      this.AppSettingsService.replaceConfig(JSON.stringify(newConfig));
    });


  }

  resetSettings() {
    this.AppSettingsService.resetSettings();
  }

  submitConfig() {
    this.AppSettingsService.replaceConfig(this.jsonConfig);
  }

  loadDemoConfig() {
    this.AppSettingsService.loadDemoConfig();
  }

}
