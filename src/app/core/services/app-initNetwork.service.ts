import { SignalKDeltaService } from './signalk-delta.service';
import { DatasetService } from './data-set.service';
import { StorageService } from './storage.service';
/**
* This Service uses the APP_INITIALIZER feature to dynamically load
* network service (SignalKConnection & Authentication) when the app is initialized,
* before loading appComponent and other stuff.
*
* @usage must return a Promise in all cases or will block app from loading.
* All execution in this service delays app start. Keep code small and simple.
**/
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IConnectionConfig } from "../interfaces/app-settings.interfaces";
import { SignalKConnectionService } from "./signalk-connection.service";
import { AuthenticationService } from './authentication.service';
import { DefaultConnectionConfig } from '../../../default-config/config.blank.const';
import { Subscription } from 'rxjs';
import { DataService } from './data.service';

const configFileVersion = 9; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.
const CONNECTION_CONFIG_KEY = 'connectionConfig';

@Injectable()
export class AppNetworkInitService implements OnDestroy {
  private config: IConnectionConfig;
  private isLoggedIn: boolean = null;
  private loggedInSubscription: Subscription = null;

  constructor (
    private connection: SignalKConnectionService,
    private auth: AuthenticationService,
    private router: Router,
    private delta: SignalKDeltaService, // Init to get data before app starts
    private data: DataService, // Init to get data before app starts
    private storage: StorageService, // Init to get data before app starts
  )
  {
    this.loggedInSubscription = this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  public async initNetworkServices() {
    this.loadLocalStorageConfig();
    this.preloadFonts();

    try {
      if (this.config?.signalKUrl !== undefined && this.config.signalKUrl !== null) {
        await this.connection.resetSignalK({url: this.config.signalKUrl, new: false}, this.config.proxyEnabled);
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
      try {
        await this.auth.login({ usr: this.config.loginName, pwd: this.config.loginPassword });
      } catch (error) {
        if (error.status === 0) {
          this.router.navigate(['/settings']);
        } else if (error.status === 401) {
          this.router.navigate(['/login']);
        }
        console.error("[AppInit Network Service] Login failure. Server returned: " + JSON.stringify(error.error));
      }
    }
  }

  private setLocalStorageConfig(): void {
    localStorage.setItem(CONNECTION_CONFIG_KEY, JSON.stringify(this.config));
  }

  private loadLocalStorageConfig(): void {
    this.config = JSON.parse(localStorage.getItem(CONNECTION_CONFIG_KEY));

    if (!this.config) {
      this.config = DefaultConnectionConfig;
      this.config.signalKUrl = window.location.origin;
      console.log(`[AppInit Network Service] Connection Configuration not found. Creating configuration using Auto-Discovery URL: ${this.config.signalKUrl}`);
      this.setLocalStorageConfig();
    } else if (!this.config.signalKUrl) {
      this.config.signalKUrl = window.location.origin;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Config found with no server URL. Setting Auto-Discovery URL: ${this.config.signalKUrl}`);
    }

    if (this.config.configVersion == 9) {
      this.config.configVersion = 10;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 9 to 10`);
    }
  }

  private preloadFonts (): void {
    // Preload fonts else browser can delay and cause canvas font issues
    const fonts = [
      {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOlCnqEu92Fr1MmSU5fChc4AMP6lbBP.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOlCnqEu92Fr1MmSU5fBBc4AMP6lQ.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOmCnqEu92Fr1Mu7GxKKTU1Kvnz.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
    {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOlCnqEu92Fr1MmEU9fChc4AMP6lbBP.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(/assets/google-fonts/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      }
    ];

    for (const {family, src, options} of fonts) {
      const font = new FontFace(family, src, options);
      font.load()
        .then(() => document.fonts.add(font))
        .catch(err => console.log(`[AppInit Network Service] Error loading fonts: ${err}`));
    }
  }

  ngOnDestroy(): void {
    this.loggedInSubscription?.unsubscribe();
  }
}
