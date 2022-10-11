import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
/*
* This Service uses the APP_INITIALIZER feature to dynamically load
* environment variables (ie. remote app config) when the app is initiaziled,
* before loading appComponment.
*
* Here we use REST to connect to the server, login, get the token, retreive
* and return the default config. If remote config cant be loaded we return NULL.
*/
import { Injectable, Injector } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { IConnectionConfig } from "./app-init.interfaces";
import { AuththeticationService } from './auththetication.service';


const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json'
  })
};
const assetConfigFilePath = '/assets/init-config.json';
const serverDataStoragePath = '/signalk/v1/applicationData/';
const serverAppDataPath = '/kip/1.0/';


@Injectable()
export class AppInitService {
  private localStorageConnectionConfig: IConnectionConfig = null;
  private isLoggedIn;
  private appConfig = null;
  private http = this.injector.get(HttpClient);

  constructor (
    private injector: Injector,
    private auth: AuththeticationService
  )
  {
    this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  initAppConfig() {
    let config = this.loadLocalStorageConfig();
    return config;

}

  private loadLocalStorageConfig(): Promise<any> {
    this.localStorageConnectionConfig = JSON.parse(localStorage.getItem('connectionConfig'));

    if (!this.localStorageConnectionConfig) {
      return Promise.reject("[AppInit Service] No Config found in LocalStorage. Possible first time the app is started");
    } else {

      if (this.localStorageConnectionConfig.signalKUrl) {
        this.auth.signalkUrl = this.localStorageConnectionConfig.signalKUrl;
      } else {
        return Promise.reject("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'SignalK API Url' in: Configuration -> Settings -> SignalK tab");
      }

      if (!this.localStorageConnectionConfig.useSharedConfig || this.localStorageConnectionConfig.useDeviceToken) {
        return Promise.reject("[AppInit Service] Shared Configuration feature disabled");
      }

      if (!this.localStorageConnectionConfig.sharedConfigName) {
        return Promise.reject("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'Shared Configuration Name' in: Configuration -> Settings -> ??? tab");
      }

      if (this.localStorageConnectionConfig.loginName
          && this.localStorageConnectionConfig.loginPassword) {

        if (!this.isLoggedIn) {
          this.auth
          .login(this.localStorageConnectionConfig.loginName, this.localStorageConnectionConfig.loginPassword)
          .subscribe((loginResponse) => {

            console.log(loginResponse);
            //TODO: route to appropriate page and handle error

          });
        }
        return this.getApplicationConfig();

      } else {
        return Promise.reject("[AppInit Service] Required settings for user shared configuration missing in LocalStorage Config. Configure 'User Credentials' settings in: Configuration -> Settings -> SignalK tab");
      }

    }
  }

  private getApplicationConfig(): Promise<any> {
    let url = this.localStorageConnectionConfig.signalKUrl;
    url += serverDataStoragePath + "user" + serverAppDataPath;
    url += this.localStorageConnectionConfig.sharedConfigName;

    console.log("[AppInit Service] Retreiving server Shared config: "+ this.localStorageConnectionConfig.sharedConfigName)
    return this.http.get<any>(url).pipe(
      tap(response =>{
        this.appConfig = response;
      })
    )
    .toPromise();
  }

  get serverConfig() {
    return this.appConfig;
  }
}
