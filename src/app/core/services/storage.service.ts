import { cloneDeep } from 'lodash-es';
import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IConfig } from "../interfaces/app-settings.interfaces";
import { compare } from 'compare-versions';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs/internal/Subject';
import { tap, concatMap, catchError, lastValueFrom, BehaviorSubject } from 'rxjs';
import { AuthenticationService } from './authentication.service';

export interface Config {
  name: string,
  scope: string
}

interface IPatchAction {
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private server = inject(SignalKConnectionService);
  private http = inject(HttpClient);
  private readonly _auth = inject(AuthenticationService);

  private serverEndpoint: string = null;
  public isAppDataSupported = false;
  private configFileVersion: number = null;
  public sharedConfigName: string;
  private InitConfig: IConfig = null;
  public storageServiceReady$ = new BehaviorSubject<boolean>(false);
  private _isLoggedIn = false;
  private _networkStatus: IEndpointStatus = undefined;
  // Instrumentation toggle
  private _logIO = false; // set to false to silence logging


  private patchQueue$ = new Subject();  // REST call queue to force sequential calls
  private patch = function (arg: IPatchAction) { // http JSON Patch function
    //console.log(`[Storage Service] Send patch request:\n${JSON.stringify(arg.document)}`);
    return this.http.post(arg.url, arg.document)
      .pipe(
        tap(() => console.log("[Storage Service] Remote config patch request completed successfully")),
        catchError((error) => this.handleError(error))
      );
  }

  constructor() {
    const server = this.server;
    // Subscriptions auto‑teardown via takeUntilDestroyed
    this._auth.isLoggedIn$
      .pipe(takeUntilDestroyed())
      .subscribe(isLoggedIn => {
        this._isLoggedIn = isLoggedIn;
        this.isStorageServiceReady();
      });

    server.serverServiceEndpoint$
      .pipe(takeUntilDestroyed())
      .subscribe((status: IEndpointStatus) => {
        this._networkStatus = status;
        this.isStorageServiceReady();
      });

    server.serverVersion$
      .pipe(takeUntilDestroyed())
      .subscribe(version => {
        if (version) {
          this.isAppDataSupported = compare(version, '1.27.0', ">=");
        }
      });

    // Patch request queue to insure JSON Patch requests to SK server don't run over each other and cause collisions/conflicts. SK does not handle multiple async applicationData access calls
    this.patchQueue$
      .pipe(concatMap((arg: IPatchAction) => this.patch(arg)), takeUntilDestroyed())
      .subscribe(() => { /* queue item processed */ });
  }

  private isStorageServiceReady(): void {
    if (this._networkStatus?.httpServiceUrl) {
      this.serverEndpoint = this._networkStatus.httpServiceUrl.substring(0, this._networkStatus.httpServiceUrl.length - 4) + "applicationData/"; // this removes 'api/' from the end;
    }

    if (this._networkStatus?.operation === 2 && this._isLoggedIn && this.serverEndpoint) {
      this.storageServiceReady$.next(true);
      console.log(`[Remote Storage Service] Authenticated ${this._isLoggedIn} ,AppData API: ${this.serverEndpoint}`);
    } else {
      this.storageServiceReady$.next(false);
    }
  }

  private ensureReady(): void {
    if (!this.storageServiceReady$.getValue()) {
      throw new Error('[StorageService] Not ready: storageServiceReady is false');
    }
  }

  /**
   * Retrieves server Application Data config lists for Kip in both Global
   * and User scopes for the current app version.
   *
   * @param {string} [forceConfigFileVersion] Optional parameter. Forces the
   * Signal K configuration file name to a specific version. If not set, configFileVersion
   * is used by default (set in app-settings and app-initNetwork services).
   * Old KIP versions used value of 1.
   *
   * @return {*}  {Promise<Config[]>}
   * @memberof StorageService
   */
  public async listConfigs(forceConfigFileVersion?: number): Promise<Config[]> {
    this.ensureReady();
    const serverConfigs: Config[] = [];
    if (!this.serverEndpoint) {
      console.warn("[Storage Service] No server endpoint set. Cannot retrieve config list");
      return null;
    }

    const base = this.serverEndpoint;
    const ver = forceConfigFileVersion ?? this.configFileVersion;
    const globalUrl = `${base}global/kip/${ver}/?keys=true`;
    const userUrl = `${base}user/kip/${ver}/?keys=true`;

    try {
      const globalNames = await lastValueFrom(this.http.get<string[]>(globalUrl));
      for (const cname of globalNames) serverConfigs.push({ scope: 'global', name: cname });
      console.log(`[Storage Service] Retrieved Global config list`);
    } catch (error) {
      this.handleError(error as HttpErrorResponse); // throws
    }

    try {
      const userNames = await lastValueFrom(this.http.get<string[]>(userUrl));
      for (const cname of userNames) serverConfigs.push({ scope: 'user', name: cname });
      console.log(`[Storage Service] Retrieved User config list`);
    } catch (error) {
      this.handleError(error as HttpErrorResponse); // throws
    }

    return serverConfigs;
  }

  /**
   * Retrieves version and name specific server Application Data config
   * from a given scope.
   *
   * @param {string} scope String value of either 'global' or 'user'
   * @param {string} configName String value of the config name
   * @param {string} [forceConfigFileVersion] Optional parameter. Forces the
   * Signal K configuration file name to a specific version. If not set, configFileVersion
   * is used by default (set in app-settings and app-initNetwork services).
   * Old KIP versions used value of 1.
   * @param {boolean} isInitLoad User for AppSettings config initialization. If True, config will be kept
   *
   * @return {*}  {IConfig}
   * @memberof StorageService
   */
  public async getConfig(scope: string, configName: string, forceConfigFileVersion?: number, isInitLoad?: boolean): Promise<IConfig> {
    this.ensureReady();
    const base = this.serverEndpoint + scope + "/kip/";
    const ver = forceConfigFileVersion ?? this.configFileVersion;
    const url = base + ver + "/" + configName; // URL for fetching config

    if (this._logIO) {
      // lightweight log before fetch
      console.debug('[StorageService.getConfig]', { scope, configName, ver, url, isInitLoad: !!isInitLoad });
    }

    try {
      const remoteConfig = await lastValueFrom(this.http.get<IConfig>(url));
      if (this._logIO) {
        const appVer: unknown = (remoteConfig && typeof remoteConfig === 'object') ? (remoteConfig as IConfig)?.app?.configVersion : undefined;
        console.debug('[StorageService.getConfig Response]', { scope, configName, ver, appConfigVersion: appVer });
      } else {
        console.log(`[Storage Service] Retrieved config [${configName}] from [${scope}] scope`);
      }
      if (isInitLoad) this.InitConfig = remoteConfig;
      return cloneDeep(remoteConfig);
    } catch (error) {
      this.handleError(error as HttpErrorResponse); // throws
      return null; // unreachable
    }
  }

  /**
   * Send configuration data to the server's Application Data service
   * with a scope, name and optional file version. The configuration will be saved using the
   * current Kip configFile Version setting, unless over written, in applicationData subfolder on the server.
   *
   * @usage If the given ConfigName exists in the provided scope for the same version,
   * the data will be overwritten/replaced, else it will be created on the server.
   *
   * @param {string} scope String value of either 'global' or 'user'
   * @param {string} configName String value of the config name
   * @param {IConfig} config config data to be saved
   * @param {number | string} [forceConfigFileVersion] Optional parameter. Forces the
   * @return {Promise<null>}  {null} returns null if operation is successful or raises an error.
   * @memberof StorageService
   */
  public async setConfig(scope: string, configName: string, config: IConfig, forceConfigFileVersion?: number | string): Promise<null> {
    this.ensureReady();

    const base = this.serverEndpoint + scope + "/kip/";
    const ver = forceConfigFileVersion ?? this.configFileVersion;
    const url = base + ver + "/" + configName; // URL for setting config

    if (this._logIO) {
      const appVer: unknown = config?.app?.configVersion;
      console.debug('[StorageService.setConfig]', { scope, configName, ver, url, appConfigVersion: appVer });
    }

    try {
      await lastValueFrom(this.http.post<null>(url, config));
      if (this._logIO) {
        console.debug('[StorageService.setConfig Response]', { scope, configName, ver, url, status: 'ok' });
      } else {
        console.log(`[Storage Service] Saved config [${configName}] to [${scope}] scope`);
      }
      return null;
    } catch (error) {
      this.handleError(error as HttpErrorResponse); // throws
      return null; // unreachable, keeps signature
    }
  }

  /**
   * Updates JSON configuration entry section in the server application storage. This uses the JSON Patch standard.
   *
   * @param {string} ObjType string describing the type of configuration object. Value can be: IAppConfig, IThemeConfig, IWidgetConfig, ILayoutConfig, Array\<IUnitDefaults\>, Array\<IDataSet\>, Array\<IZone\>, IZonesConfig, INotificationConfig
   * @param {*} value unstringified update object. The resulting outgoing POST request will automatically stringify.
   * @memberof StorageService
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public patchConfig(ObjType: string, value: any, forceConfigFileVersion?: number) {
    this.ensureReady();
    const ver = forceConfigFileVersion ?? this.configFileVersion;
    const url = this.serverEndpoint + "user/kip/" + ver;
    let document;
    // url already reflects forced version if provided

    const incomingVer: unknown = value?.configVersion;
    if (this._logIO) {
      console.warn('[StorageService.patchConfig] Suppressing app.configVersion write into v11 file', {
        targetFileVersion: ver,
        incomingAppConfigVersion: incomingVer
      });
    }

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

      case "Dashboards":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/dashboards`,
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

      case "Array<IDatasetDef>":
        document =
          [{
            "op": "replace",
            "path": `/${this.sharedConfigName}/app/dataSets`,
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

    const patch: IPatchAction = { url, document };
    if (this._logIO) {
      const appVer = ObjType === 'IAppConfig' ? (value?.configVersion) : undefined;
      const touchesConfigVersion = ObjType === 'IAppConfig' && (typeof appVer !== 'undefined');
      console.debug('[StorageService.patchConfig]', {
        ObjType,
        ver,
        url,
        appConfigVersionInValue: appVer,
        touchesConfigVersion
      });
    }
    this.patchQueue$.next(patch);
  }

  /**
   * Applies full KIP configuration entry file operations the server's Global Scope application storage.
   *
   * @param {string} configName name of the configuration.
   * @param {string} scope the storage scope to use. Can either be: 'user' or 'global'.
   * @param {string} operation string describing the type action to perform. values can be: 'add', 'replace' or 'remove'.
   * @param {IConfig} config unstringified config object. The resulting outgoing POST request will automatically stringify.
   * @param {number} fileVersion Configuration file version. Supported are 9 for current and 1 for old configs.
   * @memberof StorageService
   */
  public patchGlobal(configName: string, scope: string, config: IConfig, operation: string, fileVersion?: number) {
    this.ensureReady();
    const ver = fileVersion ?? this.configFileVersion;
  const url = this.serverEndpoint + scope + "/kip/" + ver;

    let document;
    switch (operation) {
      case "add":
        document =
          [{
            "op": "add",
            "path": `/${configName}`,
            "value": config
          }]
        break;

      case "replace":
        document =
          [{
            "op": "replace",
            "path": `/${configName}`,
            "value": config
          }]
        break;

      case "remove":
        document =
          [{
            "op": "remove",
            "path": `/${configName}`,
            "value": config
          }]
        break;

      default: console.warn("[Storage Service] JSON Patch operation request type unknown");
        break;
    }

    const patch: IPatchAction = { url, document };
    if (this._logIO) {
      const appVer: unknown = config?.app?.configVersion;
      console.debug('[StorageService.patchGlobal]', { scope, configName, operation, ver, url, appConfigVersionInValue: appVer });
    }
    this.patchQueue$.next(patch);
  }

  /**
   * Deletes/removes a full configuration entry from the server ApplicationStorage using JSON Patch standard.
   *
   * @param {string} scope destination storage scope of either global or user value
   * @param {string} name configuration name to delete
   * @param {string} [forceConfigFileVersion] Optional parameter. Forces the
   * Signal K configuration file name to a specific version. If not set, configFileVersion
   * is used by default (set in app-settings and app-initNetwork services).
   * Old KIP versions used value of 1.
   *
   * @memberof StorageService
   */
  public removeItem(scope: string, name: string, forceConfigFileVersion?: number) {
    this.ensureReady();
    let url = this.serverEndpoint + scope + "/kip/" + this.configFileVersion;
    if (forceConfigFileVersion) {
      url = this.serverEndpoint + scope + "/kip/" + forceConfigFileVersion;
    }
    const document =
      [
        {
          "op": "remove",
          "path": `/${name}`
        }
      ]
    const patch: IPatchAction = { url, document };
    this.patchQueue$.next(patch);
  }

  /**
   * *** Not implemented
   */
  public clear() {
    this.ensureReady();

  }

  public set activeConfigFileVersion(v: number) {
    this.configFileVersion = v;
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
