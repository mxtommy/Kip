import { Injectable, inject, signal, effect, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SignalKConnectionService } from './signalk-connection.service';

interface plugin {
  id: string;
  versionRequirement: string | null;
}


interface skFeatures {
  apis: string[];
  plugins: PluginInformation[]
}

interface PluginInformation {
    id: string;
    name: string;
    version: string;
    enabled: boolean
}

@Injectable({ providedIn: 'root' })
export class SignalkPluginsService {
  private readonly _TRACKED_PLUGINS: plugin[] = [
    { id: 'derived-data', versionRequirement: null },
    { id: 'signalk-autostate', versionRequirement: null },
    { id: 'signalk-polar-performance-plugin', versionRequirement: null },
    { id: 'autopilot', versionRequirement: null },
  ];

  private _connectionSvc = inject(SignalKConnectionService);
  private _API_URL = signal<string | null>(null);

  private _connection = toSignal(this._connectionSvc.getServiceEndpointStatusAsO());

  private _pluginInformation = resource<skFeatures, unknown>({
    loader: async ({ abortSignal }) => {
      const url = this._API_URL();
      if (!url) {
        console.error('API URL not set yet.');
        return [];
      }

      try {
        const response = await fetch(url, { signal: abortSignal });
        if (!response.ok) {
          console.error('[SkPlugin Service] Error fetching plugin information:', response.statusText);
          return [];
        }
        return await response.json();
      } catch (error) {
        console.error('[SkPlugin Service] Error fetching plugin information:', error);
        return [];
      }
    },
  });

  constructor() {
    this._API_URL.set(
      `${this._connectionSvc.signalKURL.url}/signalk/v2/features?enabled=enabled`
    );
  }

  public async isEnabled(pluginId: string): Promise<boolean> {
    this._pluginInformation.reload();

    // Wait for the resource to finish loading
    while (this._pluginInformation.isLoading()) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 50ms
    }

    const features = this._pluginInformation.value();

    if (!features || !features.plugins || features.plugins.length === 0) {
      return false;
    }
    return features.plugins.some((plugin) => plugin.id === pluginId && plugin.enabled);
  }
}
