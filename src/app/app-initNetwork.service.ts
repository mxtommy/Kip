import { StorageService } from './storage.service';
/**
* This Service uses the APP_INITIALIZER feature to dynamically load
* network service (SignalKConnection & Authentication) when the app is initialized,
* before loading appComponent and other stuff.
*
* @usage must return a Promise in all cases or will block app from loading.
* All execution in this service delays app start. Keep code small and simple.
**/
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IConnectionConfig } from "./app-settings.interfaces";
import { SignalKConnectionService } from "./signalk-connection.service";
import { AuthenticationService } from './authentication.service';
import { DefaultConnectionConfig } from './config.blank.const';
import { UUID } from './uuid';

const configFileVersion = 9; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.

@Injectable()
export class AppNetworkInitService {
  private config: IConnectionConfig;
  private isLoggedIn;

  constructor (
    private connection: SignalKConnectionService,
    private auth: AuthenticationService,
    private router: Router,
    private storage: StorageService, // early boot up for AppSetting svc
  )
  {
    this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  public async initNetworkServices() {
    this.loadLocalStorageConfig();

    try {
      if (this.config?.signalKUrl !== undefined && this.config.signalKUrl !== null) {
        await this.connection.resetSignalK({url: this.config.signalKUrl, new: false});
      }

      if (!this.isLoggedIn && this.config?.signalKUrl && this.config?.useSharedConfig && this.config?.loginName && this.config?.loginPassword) {
        await this.login();
      }

      if (this.isLoggedIn && this.config?.useSharedConfig) {
        this.storage.activeConfigFileVersion = configFileVersion;
        this.storage.sharedConfigName = this.config.sharedConfigName;
        await this.storage.getConfig("user", this.config.sharedConfigName, configFileVersion, true);
      }

      if (!this.isLoggedIn && this.config?.signalKUrl && this.config?.useSharedConfig) {
        this.router.navigate(['/login']); // need to set credentials
      }

    } catch (error) {
      console.warn("[AppInit Network Service] Services loaded. Connection attempt unsuccessful");
      console.error(error);
      return Promise.reject("[AppInit Network Service] Services loaded. Connection issue");
    } finally {
      console.log("[AppInit Network Service] Initialization completed");
    }
  }

  private async login(): Promise<void> {
    if (!this.isLoggedIn && this.config.useSharedConfig && this.config.loginName && this.config.loginPassword) {
      await this.auth.login({ usr: this.config.loginName, pwd: this.config.loginPassword })
      .catch( (error: HttpErrorResponse) => {
        if (error.status === 0) {
          this.router.navigate(['/settings']);
        } else if (error.status === 401) {
          this.router.navigate(['/login']);
        }
        console.error("[AppInit Network Service] Login failure. Server returned: " + JSON.stringify(error.error));
      });
    }
  }

  private loadLocalStorageConfig(): void {
    this.config = JSON.parse(localStorage.getItem('connectionConfig'));

    if (!this.config) {
      this.config = DefaultConnectionConfig;
      this.config.kipUUID = UUID.create();
      this.config.signalKUrl = window.location.origin;
      console.log(`[AppInit Network Service] Connection Configuration not found. Creating configuration using Auto-Discovery URL: ${this.config.signalKUrl}`);
      localStorage.setItem('connectionConfig', JSON.stringify(this.config));

    } else if (!this.config.signalKUrl) {
      this.config.signalKUrl = window.location.origin;
      localStorage.setItem('connectionConfig', JSON.stringify(this.config));
      console.log(`[AppInit Network Service] Config found with no server URL. Setting Auto-Discovery URL: ${this.config.signalKUrl}`);
    }
  }
}
