import { Injectable, inject, signal, resource } from '@angular/core';
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

  /**
   * Loads and returns the current list of plugins from the Signal K server.
   * This method triggers a reload of the plugin information resource and waits until the data is available.
   *
   * @returns Promise resolving to an array of PluginInformation objects. Returns an empty array if loading fails or no plugins are found.
   */
  private async getPluginInformation(): Promise<PluginInformation[]> {
    this._pluginInformation.reload();
    // Wait for the resource to finish loading
    while (this._pluginInformation.isLoading()) {
      // Poll every 100ms until the resource is loaded
      await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
    }
    return this._pluginInformation.value()?.plugins || [];
  }

  /**
   * Checks if a plugin with the given ID is installed on the Signal K server.
   * @param pluginId The ID of the plugin to check.
   * @returns Promise resolving to true if the plugin is installed, false otherwise.
   *
   * @example
   * // Usage in a synchronous function:
   * signalkPluginsService.isInstalled('autopilot').then((installed) => {
   *   if (installed) {
   *     console.log('Autopilot plugin is installed.');
   *   }
   * });
   *
   * // Usage in an async function:
   * const installed = await signalkPluginsService.isInstalled('autopilot');
   * if (installed) {
   *   console.log('Autopilot plugin is installed.');
   * }
   *
   */
  public async isInstalled(pluginId: string): Promise<boolean> {
    const plugins = await this.getPluginInformation();

    if (!plugins || plugins.length === 0) {
      return false;
    }
    return plugins.some((plugin) => plugin.id === pluginId);
  }

  /**
   * Checks if a plugin with the given ID is both installed and enabled on the Signal K server.
   * @param pluginId The ID of the plugin to check.
   * @returns Promise resolving to true if the plugin is installed and enabled, false otherwise.
   *
   * @example
   * // Usage in a synchronous function:
   * signalkPluginsService.isEnabled('autopilot').then((enabled) => {
   *   if (enabled) {
   *     console.log('Autopilot plugin is enabled.');
   *   }
   * });
   * // Usage in an async function:
   * const enabled = await signalkPluginsService.isEnabled('autopilot');
   * if (enabled) {
   *   console.log('Autopilot plugin is enabled.');
   * }
   *
   */
  public async isEnabled(pluginId: string): Promise<boolean> {
    const plugins = await this.getPluginInformation();

    if (!plugins || plugins.length === 0) {
      return false;
    }
    return plugins.some((plugin) => plugin.id === pluginId && plugin.enabled);
  }
}
