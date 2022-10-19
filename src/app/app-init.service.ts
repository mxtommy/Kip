/*
* This Service uses the APP_INITIALIZER feature to dynamically load
* environment variables (ie. remote app config) when the app is initiaziled,
* before loading appComponment.
*
* Here we use REST to connect to the server, login, get the token, retreive
* and return the default config. If remote config cant be loaded we return NULL.
*/
import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IConnectionConfig, IConfig } from "./app-settings.interfaces";
import { AuththeticationService } from './auththetication.service';

const serverDataStoragePath = '/signalk/v1/applicationData/';
const serverAppDataPath = '/kip/';

@Injectable()
export class AppInitService {
  private localStorageConnectionConfig: IConnectionConfig = null;
  private isLoggedIn;
  private appConfig: IConfig = null;
  private http = this.injector.get(HttpClient);

  constructor (
    private injector: Injector,
    private router: Router,
    private auth: AuththeticationService,
  )
  {
    this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  async initAppConfig() {
    let remoteConfigEnabled: boolean = this.loadLocalStorageConfig();

    if (remoteConfigEnabled) {
      console.log("[AppInit Service] Shared Config configuration enabled");
      if (!this.isLoggedIn) {
        await this.auth.login({ usr: this.localStorageConnectionConfig.loginName, pwd: this.localStorageConnectionConfig.loginPassword })
        .catch( (error: HttpErrorResponse) => {
          if (error.status === 0) {
            this.router.navigate(['/settings']);
          } else if (error.status === 401) {
            this.router.navigate(['/login']);
          }
          console.error("[AppInit Service] Server returned: " + JSON.stringify(error.error));
        });
      }

      if (this.isLoggedIn) {
        let url = this.localStorageConnectionConfig.signalKUrl;
        url += serverDataStoragePath + "user" + serverAppDataPath;
        url += this.localStorageConnectionConfig.configVersion + "/"
        url += this.localStorageConnectionConfig.sharedConfigName;

        console.log("[AppInit Service] Retreiving server config: " + this.localStorageConnectionConfig.sharedConfigName);

        return await lastValueFrom(this.http.get<IConfig>(url))
          .then(config =>{
            this.appConfig = config;
            console.log("[AppInit Service] Server config: " + this.localStorageConnectionConfig.sharedConfigName + " retreived");
          })
          .catch((error: HttpErrorResponse) => {
            console.error("[AppInit Service] Error retreiving server config: " + error.message);
          });
      } else {
        return Promise.reject("[AppInit Service] Shared Config configuration disabled");
      }
    }
  }

  private loadLocalStorageConfig(): boolean {
    this.localStorageConnectionConfig = JSON.parse(localStorage.getItem('connectionConfig'));

    if (!this.localStorageConnectionConfig) {
      console.log("[AppInit Service] No Connection Config found in LocalStorage. Possible first time the app is started");
      return false;
    } else {

      if (this.localStorageConnectionConfig.signalKUrl) {
        this.auth.signalkUrl = this.localStorageConnectionConfig.signalKUrl;
      } else {
        console.warn("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'SignalK API Url' in: Configuration -> Settings -> SignalK tab");
        return false;
      }

      if (!this.localStorageConnectionConfig.useSharedConfig || this.localStorageConnectionConfig.useDeviceToken) {
        console.warn("[AppInit Service] Shared Configuration feature disabled");
        return false;
      }

      if (!this.localStorageConnectionConfig.sharedConfigName) {
        console.warn("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'Shared Configuration Name' in: Configuration -> Settings -> ??? tab");
        return false;
      }

      if (this.localStorageConnectionConfig.loginName
          && this.localStorageConnectionConfig.loginPassword) {
        return true;
      } else {
        console.warn("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'User Credentials' settings in: Configuration -> Settings -> SignalK tab");
        return false;
      }
    }
  }

  get serverConfig() {
    return this.appConfig;
  }
}
