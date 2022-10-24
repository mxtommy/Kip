import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { Injectable } from '@angular/core';
import { IConfig, IAppConfig, ILayoutConfig, IThemeConfig, IZonesConfig } from "./app-settings.interfaces";
import * as compareVersions from 'compare-versions';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs/internal/Subject';

interface Config {
  name: string,
  scope: string
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private serverEndpoint: String = null;
  public isAppDataSupported: boolean = false;
  private serverConfigs: Config[] = [];
  private configVersion: number = null;
  public storageServiceReady$: Subject<boolean> = new Subject<boolean>();


  constructor(
    private server: SignalKConnectionService,
  ) {
      server.serverServiceEndpoint$.subscribe((status: IEndpointStatus) => {
        console.log("*************************** " + status.httpServiceUrl);
        if (status.httpServiceUrl !== null) {

        }

        if (status.operation === 2) {
          this.storageServiceReady$.next(true);
        } else {
          this.storageServiceReady$.next(false);
        }
      });

      server.serverVersion$.subscribe(version => {
      if (version) {
        this.isAppDataSupported = compareVersions.compare(version, '1.27.0', ">=");
      }
    });
  }

  public async listConfigs() {
    let serverConfigs: Config[] = [];
    await this.server.getApplicationDataKeys('global', this.configVersion)
      .then((configNames: string[]) => {
        for(let cname of configNames) {
          serverConfigs.push({ scope: 'global', name: cname });
        }
        console.log(`[Storage Service] Retreive Global config list`);
      })
      .catch(error => {
        this.handleError(error);
      });

    await this.server.getApplicationDataKeys('user', this.configVersion)
      .then((configNames: string[]) => {
        for(let cname of configNames) {
          serverConfigs.push({ scope: 'user', name: cname });
        }
        console.log(`[Storage Service] Retreived User config list`);
      })
      .catch(error => {
        this.handleError(error);
      });

    return serverConfigs;
  }

  public async getConfig(scope: string, configName: string): Promise<IConfig> {
    let conf: IConfig = null;
    await this.server.getApplicationData(scope, this.configVersion, configName)
      .then(remoteConfig => {
        conf = remoteConfig;
        console.log(`[Storage Service] Retreived ${scope} config ${configName}`);
      })
      .catch(error => {
        this.handleError(error);
      });

    return conf;
  }

  public async setConfig(scope: string, configName: string, config: IConfig): Promise<boolean> {
    let result: boolean = false;
    await this.server.postApplicationData(scope, this.configVersion, configName, config)
      .then( _ => {
        result = true;
        console.log(`[Storage Service] Saved config ${configName} to server`);
      })
      .catch(error => {
        this.handleError(error);
      });

    return result;
  }

  /**
   * removeItem
   */
  public removeItem() {

  }

  /**
   * name
   */
  public clear() {

  }

  public set activeConfigVersion(v : number) {
    this.configVersion = v;
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('[Storage Service] An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(`[Storage Service] Backend returned: `, error.message);
    }
    // Return an observable with a user-facing error message.
    throw error;
  }

}
