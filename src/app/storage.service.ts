import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { Injectable } from '@angular/core';
import { IConfig, IAppConfig, ILayoutConfig, IThemeConfig, IZonesConfig } from "./app-settings.interfaces";
import * as compareVersions from 'compare-versions';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs/internal/Subject';
import { lastValueFrom } from 'rxjs';

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
  private InitConfig: IConfig = null;
  public storageServiceReady$: Subject<boolean> = new Subject<boolean>();


  constructor(
    private server: SignalKConnectionService,
    private http: HttpClient
  ) {
      server.serverServiceEndpoint$.subscribe((status: IEndpointStatus) => {
        if (status.httpServiceUrl !== null) {
          this.serverEndpoint = status.httpServiceUrl.substring(0,status.httpServiceUrl.length - 4) + "applicationData/"; // this removes 'api/' from the end;
          console.log("[Storage Service] Service stratup. AppData API set to: " + this.serverEndpoint);
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

  /**
   * Retreives server Application Data config lists for Kip in both Global
   * and User scopes for the current app version.
   *
   * @return {*}  {Promise<Config[]>}
   * @memberof StorageService
   */
  public async listConfigs(): Promise<Config[]> {
    let serverConfigs: Config[] = [];
    const url = this.serverEndpoint;
    let globalUrl = url + "global/kip/" + this.configVersion + "/?keys=true";
    let userUrl = url + "user/kip/" + this.configVersion + "/?keys=true";

    await lastValueFrom(this.http.get<string[]>(globalUrl))
      .then((configNames: string[]) => {
        for(let cname of configNames) {
          serverConfigs.push({ scope: 'global', name: cname });
        }
        console.log(`[Storage Service] Retreived Global config list`);
      })
      .catch(
        error => {
          this.handleError(error);
      });

    await lastValueFrom(this.http.get<string[]>(userUrl))
      .then((configNames: string[]) => {
        for(let cname of configNames) {
          serverConfigs.push({ scope: 'user', name: cname });
        }
        console.log(`[Storage Service] Retreived User config list`);
      })
      .catch(
        error => {
          this.handleError(error);
      });

    return serverConfigs;
  }

  /**
   * Retreives version and name specific server Application Data config
   * for a given scope.
   *
   * @param {string} scope String value of either 'global' or 'user'
   * @param {string} configName String value of the config name
   * @param {boolean} isInitLoad User for AppSettings Init. If True, config will be keept
   * @return {*}  {IConfig}
   * @memberof StorageService
   */
  public async getConfig(scope: string, configName: string, isInitLoad?: boolean): Promise<IConfig> {
    let conf: IConfig = null;
    let url = this.serverEndpoint + scope +"/kip/" + this.configVersion + "/" + configName;

    await lastValueFrom(this.http.get<any>(url))
      .then(remoteConfig => {
        conf = remoteConfig;
        console.log(`[Storage Service] Retreived ${scope} config ${configName}`);
        if (isInitLoad) {
          this.InitConfig = remoteConfig;
        }
      })
      .catch(error => {
          this.handleError(error);
      });
    return conf;
  }

  /**
   * Send configuration data to the server Application Data service
   * with a scope and name. The configuration will be saved in the
   * current Kip app version subfolder on the server.
   *
   * @usage If the given ConfigName exists in the provided scope for the same version,
   * the data will be overwriten/replaced on the server.
   *
   * @param {string} scope String value of either 'global' or 'user'
   * @param {string} configName String value of the config name
   * @param {IConfig} config config data to be saved
   * @return {*}  {boolean} returns True if operation is successful
   * @memberof StorageService
   */
  public setConfig(scope: string, configName: string, config: IConfig): Promise<void> {
    let result: boolean = false;
    let url = this.serverEndpoint + scope +"/kip/" + this.configVersion + "/"+ configName;

    return lastValueFrom(this.http.post<any>(url, config))
      .then( _ => {
        result = true;
        console.log(`[Storage Service] Saved config ${configName} to server`);
      })
      .catch(error => {
        this.handleError(error);
      });
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

  public get defaultRemoteConfig() : IConfig {
    return this.InitConfig;
  }

}
