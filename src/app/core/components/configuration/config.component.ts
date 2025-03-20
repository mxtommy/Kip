import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule }    from '@angular/forms';

import { AuthenticationService, IAuthorizationToken } from '../../services/authentication.service';
import { AppService } from '../../services/app-service';
import { AppSettingsService } from '../../services/app-settings.service';
import { IConfig, IAppConfig } from '../../interfaces/app-settings.interfaces';
import { StorageService } from '../../services/storage.service';
import { cloneDeep } from 'lodash-es';
import { HttpErrorResponse } from '@angular/common/http';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../page-header/page-header.component';


interface IRemoteConfig {
  scope: string,
  name: string
}

@Component({
    selector: 'settings-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    standalone: true,
    imports: [RouterLink, NgIf, FormsModule, MatDivider, MatButton, MatFormField, MatLabel, MatSelect, MatOption, MatInput, NgFor, ReactiveFormsModule, MatRadioGroup, MatRadioButton, PageHeaderComponent]
})
export class SettingsConfigComponent implements OnInit, OnDestroy{
  protected readonly pageTitle: string = "Configurations";
  public hasToken: boolean = false;
  public isTokenTypeDevice: boolean = false;
  private tokenSub: Subscription;

  public supportApplicationData: boolean = false;
  public serverConfigList: IRemoteConfig[] = [];
  public serverUpgradableConfigList: IRemoteConfig[] = [];

  public copyConfigForm: UntypedFormGroup;
  public storageLocation: string = null;
  public locations: string[] = ["Local Storage", "Server Storage"];

  public saveConfigName: string = null;
  public saveConfigScope: string = null;
  public deleteConfigItem: IRemoteConfig;

  constructor(
    private appSettingsService: AppSettingsService,
    private storageSvc: StorageService,
    private appService: AppService,
    private auth: AuthenticationService,
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
          this.saveConfigScope ='global';
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
      src.setValue('Server Storage');
      src.disable();
      this.copyConfigForm.get('sourceTarget').enable();

      let dest = this.copyConfigForm.get('copyDestination');
      dest.setValue('Local Storage');
      dest.disable();
    }

    this.supportApplicationData = this.storageSvc.isAppDataSupported;
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
      .catch((error: HttpErrorResponse) => {
        let errMsg: string = null;

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

  public saveConfig(conf: IConfig, scope: string, name: string, dontRefreshConfigList?: boolean) {
    if (this.supportApplicationData) {
      if (this.storageSvc.setConfig(scope, name, conf)) {
        this.appService.sendSnackbarNotification(`Configuration [${name}] saved to [${scope}] storage scope`, 5000, false);
        if (!dontRefreshConfigList) {
          this.getServerConfigList();
        }
      } else {
        this.appService.sendSnackbarNotification("Error saving configuration to server", 0, false);
      }
    }
  }

  public async copyConfig() {
    if (this.copyConfigForm.value.copySource === 'Local Storage') {
      if (this.copyConfigForm.value.copyDestination === 'Server Storage') {
        // local to remote
        this.saveConfig(this.getLocalConfigFromLocalStorage(), this.copyConfigForm.value.destinationTarget.scope, this.copyConfigForm.value.destinationTarget.name);
        if (this.copyConfigForm.value.destinationTarget.scope === 'user' && this.copyConfigForm.value.destinationTarget.name === 'default' && this.hasToken && !this.isTokenTypeDevice) {
          this.appSettingsService.reloadApp();
        }
      }
      else if(this.copyConfigForm.value.copyDestination === 'Local Storage') {
        // local to local
        this.appService.sendSnackbarNotification("Local Storage cannot be copies to Local Storage ", 0, false);
      }

    } else {
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

      if (this.copyConfigForm.value.copyDestination === 'Server Storage') {
        //remote to remote
        this.saveConfig(conf, this.copyConfigForm.value.destinationTarget.scope, this.copyConfigForm.value.destinationTarget.name);
        if (this.copyConfigForm.value.destinationTarget.scope === 'user' && this.copyConfigForm.value.destinationTarget.name === 'default' && this.hasToken && !this.isTokenTypeDevice) {
          this.appSettingsService.reloadApp();
        }
      } else {
        // remote to local
        this.appSettingsService.replaceConfig("appConfig", conf.app, false);
        this.appSettingsService.replaceConfig("themeConfig", conf.theme, false);
      }
    }
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
    let localConfig: IConfig = {
      "app": this.appSettingsService.getAppConfig(),
      "dashboards": this.appSettingsService.getDashboardConfig(),
      "theme": this.appSettingsService.getThemeConfig(),
    };
    return localConfig;
  }

  public getLocalConfigFromLocalStorage(): IConfig {
    let localConfig: IConfig = {
      "app": this.appSettingsService.loadConfigFromLocalStorage('appConfig'),
      "dashboards": this.appSettingsService.loadConfigFromLocalStorage('dashboardConfig'),
      "theme": this.appSettingsService.loadConfigFromLocalStorage('themeConfig'),
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
