import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { Injectable } from '@angular/core';
import { IConfig } from "./app-settings.interfaces";
import { compare } from 'compare-versions';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs/internal/Subject';
import { tap, concatMap, catchError, lastValueFrom } from 'rxjs';

interface Config {
  name: string,
  scope: string
}

interface IPatchAction {
  url: string,
  document: any
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private serverEndpoint: String = null;
  public isAppDataSupported: boolean = false;
  private serverConfigs: Config[] = [];
  private configVersion: number = null;
  public sharedConfigName: string;
  private InitConfig: IConfig = null;
  public storageServiceReady$: Subject<boolean> = new Subject<boolean>();

  private patchQueue$ = new Subject();  // REST call queue to force sequential calls
  private patch = function(arg: IPatchAction) { // http JSON Patch function
    //console.log(`[Storage Service] Send patch request:\n${JSON.stringify(arg.document)}`);
    return this.http.post(arg.url, arg.document)
      .pipe(
        tap((_) => console.log("[Storage Service] Remote config patch request completed successfuly")),
        catchError((error) => this.handleError(error))
      );
  }

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
        this.isAppDataSupported = compare(version, '1.27.0', ">=");
      }
    });

    // Patch request queue to insure JSON Patch requests to SK server don't run over each other and cause collisions/conflicts. SK does not handle multiple async applicationData access calls
    this.patchQueue$
      .pipe(
          concatMap((arg: IPatchAction) => this.patch(arg)) // insures orderly call senquencing
        )
      .subscribe(_ => {
        //console.log("[Storage Service] Subscription results received")
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
        console.log(`[Storage Service] Retreived config [${configName}] from [${scope}] scope`);
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
    let url = this.serverEndpoint + scope +"/kip/" + this.configVersion + "/"+ configName;

    return lastValueFrom(this.http.post<any>(url, config))
      .then( _ => {
        console.log(`[Storage Service] Saved config [${configName}] to [${scope}] scope`);
      })
      .catch(error => {
        this.handleError(error);
      });
  }

  /**
   * Udpates JSON configuration entry section in the server application storage. This uses the JSON Patch standard.
   *
   * @param {string} ObjType string describing the type of configuration object. Value can be: IAppConfig, IThemeConfig, IWidgetConfig, ILayoutConfig, Array\<IUnitDefaults\>, Array\<IDataSet\>, Array\<IZone\>, IZonesConfig, INotificationConfig
   * @param {*} value unstrignified update object. The resulting outgoing POST request will automatically strignify.
   * @memberof StorageService
   */
  public patchConfig(ObjType: string, value: any) {

    let url = this.serverEndpoint + "user/kip/" + this.configVersion;
    let document;

    switch (ObjType) {
      case "IAppConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/app`,
            "value": value
          }]
        break;

      case "IThemeConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/theme/themeName`,
            "value": value.themeName
          }]
        break;

      case "IWidgetConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/widget`,
            "value": value
          }]
        break;

      case "ILayoutConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/layout`,
            "value": value
          }]
        break;

      case "Array<IUnitDefaults>":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/app/unitDefaults`,
            "value": value
          }]
        break;

      case "Array<IDataSet>":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/app/dataSets`,
            "value": value
          }]
        break;

      case "Array<IZone>":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/zones/zones`,
            "value": value
          }]
        break;

      case "IZonesConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/zones`,
            "value": value
          }]
        break;

      case "INotificationConfig":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/app/notificationConfig`,
            "value": value
          }]
        break;

      default: console.warn("[Storage Service] JSON Patch request type unknown");
        break;
    }

    let patch: IPatchAction = {url, document};
    this.patchQueue$.next(patch);
  }

  /**
   * Deletes/removes a full configuration entry from the server ApplicationStorage using JSON Patch standard.
   *
   * @param {string} scope destination storage scope of either global or user value
   * @param {string} name configuration name to delete
   * @memberof StorageService
   */
  public removeItem(scope: string, name: string) {
    let url = this.serverEndpoint + scope + "/kip/" + this.configVersion;
    let document =
    [
      {
          "op": "remove",
          "path": `/${name}`
      }
    ]
    let patch: IPatchAction = {url, document};
    this.patchQueue$.next(patch);
  }

  /**
   * *** Not implemented
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
      console.error(`[Storage Service] Backend returned error: `, error.message);
    }
    // Return an observable with a user-facing error message.
    throw error;
  }

  public get initConfig(): IConfig {
    return this.InitConfig;
  }

}
