import { Injectable, inject } from '@angular/core';
import { SignalkPluginConfigService } from './signalk-plugin-config.service';

@Injectable({ providedIn: 'root' })
export class SignalkPluginsService {
  private readonly pluginConfig = inject(SignalkPluginConfigService);

  /**
   * Loads and returns the current list of plugins from the Signal K server.
   * This method triggers a reload of the plugin information resource and waits until the data is available.
   *
   * @returns Promise resolving to an array of PluginInformation objects. Returns an empty array if loading fails or no plugins are found.
   */
  private async getPluginInformation(): Promise<{ id: string; enabled: boolean }[]> {
    const result = await this.pluginConfig.listPlugins();
    if (!result.ok) {
      return [];
    }

    return result.data.map(plugin => ({
      id: plugin.id,
      enabled: plugin.state.enabled,
    }));
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
