import { httpResource } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { SignalKConnectionService } from './signalk-connection.service';
import { toSignal } from '@angular/core/rxjs-interop';

interface plugin {
  id: string;
  versionRequirement: string | null;
}

interface PluginInformation {
  id:	string,
  name:	string,
  packageName: string,
  keywords:	string[],
  version: string,
  description: string,
  schema: {},
  statusMessage: string,
  data:	{
    configuration: {},
    enabled: boolean,
    enableLogging: boolean,
    enableDebug: boolean
  }
}

interface pluginDetails {
    enabled: boolean,
    enabledByDefault: boolean,
    id: string,
    name: string,
    version: string
}

@Injectable({
  providedIn: 'root'
})
export class SignalkPluginsService {
  private readonly _TRACKED_PLUGINS: plugin[] = [
    { id: "derived-data", versionRequirement: null },
    { id: "signalk-autostate", versionRequirement: null },
    { id: "signalk-polar-performance-plugin", versionRequirement: null },
    { id: "autopilot", versionRequirement: null },
  ];
  private _connectionSvc = inject(SignalKConnectionService)
  private _API_URL = signal<string | null>('');
  private _pluginInformation = httpResource<PluginInformation[]>(
    () => `${this._API_URL()}/plugins`
  );
  private _connection = toSignal(this._connectionSvc.getServiceEndpointStatusAsO());

  constructor() {
    effect(() => {
      if (this._connection().operation === 2) {
        this._API_URL.set(this._connectionSvc.signalKURL.url);
      }
    });
  }

  public isEnabled(pluginId: string): boolean {
    this._pluginInformation.reload();
    const plugins = this._pluginInformation.value();
    if (!plugins) {
      return false; // Return false if no plugin information is available
    }
    return plugins.some((plugin) => {
      return plugin.id === pluginId && plugin.data.enabled;
    });
  }
}
