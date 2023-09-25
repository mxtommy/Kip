import { StorageService } from './storage.service';
/**
* This Service uses the APP_INITIALIZER feature to dynamically load
* network service (SignalKConnection & Authentication) when the app is initiaziled,
* before loading appComponment and other stuff.
*
* @usage must return a Promise in all cases or will block app from loading.
* All execution in this service delays app start. Keep code small and simple.
**/
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IConnectionConfig, ISignalKUrl } from "./app-settings.interfaces";
import { SignalKConnectionService } from "./signalk-connection.service";
import { AuththeticationService } from './auththetication.service';

@Injectable()
export class AppNetworkInitService {
  private config: IConnectionConfig;
  private isLoggedIn;

  constructor (
    private connection: SignalKConnectionService,
    private auth: AuththeticationService,
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
        this.storage.activeConfigVersion = this.config.configVersion;
        this.storage.sharedConfigName = this.config.sharedConfigName;
        await this.storage.getConfig("user", this.config.sharedConfigName, true);
      }

      if (!this.isLoggedIn && this.config?.signalKUrl && this.config?.useSharedConfig) {
        this.router.navigate(['/login']); // need to set credentials
      }

    } catch (error) {
      console.warn("[AppInit Network Service] Services loaded. Connection is not configured");
      console.error(error);
      return Promise.reject("[AppInit Network Service] Services loaded. Conneciton not configured");
    } finally {
      console.log("[AppInit Network Service] Initialyzation completed");
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
      console.log("[AppInit Network Service] No Connection Config found in LocalStorage. Maybe a first time app start");

    } else if (!this.config.signalKUrl) {
      console.warn("[AppInit Network Service] Config found but no server URL is present");
    }
  }
}
