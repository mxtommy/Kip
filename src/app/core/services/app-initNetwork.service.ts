/**
* This Service uses the APP_INITIALIZER feature to dynamically load
* network service (SignalKConnection & Authentication) when the app is initialized,
* before loading appComponent and other stuff.
*
* @usage must return a Promise in all cases or will block app from loading.
* All execution in this service delays app start. Keep code small and simple.
**/
import { inject, Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IConnectionConfig } from "../interfaces/app-settings.interfaces";
import { SignalKConnectionService } from "./signalk-connection.service";
import { AuthenticationService } from './authentication.service';
import { DefaultConnectionConfig } from '../../../default-config/config.blank.const';
import { Subscription } from 'rxjs';
import { DataService } from './data.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { StorageService } from './storage.service';
import { ConnectionStateMachine } from './connection-state-machine.service';

const configFileVersion = 11; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.
const CONNECTION_CONFIG_KEY = 'connectionConfig';

@Injectable()
export class AppNetworkInitService implements OnDestroy {
  private config: IConnectionConfig;
  private isLoggedIn: boolean = null;
  private loggedInSubscription: Subscription = null;

  private connection = inject(SignalKConnectionService);
  private auth = inject(AuthenticationService);
  private connectionStateMachine = inject(ConnectionStateMachine);
  private router = inject(Router);
  private delta = inject(SignalKDeltaService); // Init to get data before app starts
  private data = inject(DataService); // Init to get data before app starts
  private storage = inject(StorageService); // Init to get data before app starts

  constructor () {
    this.loggedInSubscription = this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  public async initNetworkServices() {
    this.loadLocalStorageConfig();
    this.preloadFonts();

    try {
      if (this.config?.signalKUrl !== undefined && this.config.signalKUrl !== null) {
        // Use SignalKConnectionService to initialize connection with the configured URL
        await this.connection.initializeConnection(
          {url: this.config.signalKUrl, new: false},
          this.config.proxyEnabled,
          this.config.signalKSubscribeAll
        );
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
      if (error.status === 0) {
        console.warn("[AppInit Network Service] Initialization failed. Network error. Redirecting to settings page.");
      } else if (error.status === 401) {
        console.warn("[AppInit Network Service] Initialization failed. Unauthorized access. Redirecting to login page.");
      } else {
        console.warn("[AppInit Network Service] Initialization failed. Error: ", JSON.stringify(error));
      }
      return Promise.reject("[AppInit Network Service] Startup completed with connection issue.");
    } finally {
      console.log("[AppInit Network Service] Initialization completed");
      // Enable WebSocket functionality now that initialization is complete
      this.connectionStateMachine.enableWebSocketMode();

      // Start WebSocket connection if HTTP discovery was successful
      if (this.connectionStateMachine.isHTTPConnected()) {
        console.log("[AppInit Network Service] Starting WebSocket connection after initialization");
        this.connectionStateMachine.startWebSocketConnection();
      }
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
        throw error;  // Re-throw the error to be handled by the caller
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
    if (this.config.configVersion == 10) {
      this.config.configVersion = 11;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 10 to 11`);
    }
    if (this.config.configVersion == 11) {
      this.config.configVersion = 12;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 11 to 12`);
    }
  }

  private preloadFonts (): void {
    // Preload fonts else browser can delay and cause canvas font issues
    const fonts = [
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmSU5fChc4AMP6lbBP.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmSU5fBBc4AMP6lQ.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOmCnqEu92Fr1Mu7GxKKTU1Kvnz.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
    {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmEU9fChc4AMP6lbBP.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      }
    ];

    for (const {family, src, options} of fonts) {
      const font = new FontFace(family, src, options);
      font.load()
        .then(() =>
          document.fonts.add(font)
      )
        .catch(err =>
          console.log(`[AppInit Network Service] Error loading fonts: ${err}`)
        );
    }
  }

  ngOnDestroy(): void {
    this.loggedInSubscription?.unsubscribe();
  }
}
