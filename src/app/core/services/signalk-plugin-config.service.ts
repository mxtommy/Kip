import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { SignalKConnectionService } from './signalk-connection.service';
import {
  IPluginApiCapabilities,
  IPluginApiFailure,
  IPluginApiError,
  IPluginApiResult,
  IPluginConfigSaveRequest,
  IPluginConfigSaveResult,
  IPluginConfigState,
  IPluginDependencyRequirement,
  IPluginDependencyValidationResult,
  IPluginSchemaField,
  IPluginSchemaNormalization,
  IRawPluginDetail,
  IRawPluginInformation,
  ISignalkPlugin,
} from '../interfaces/signalk-plugin-config.interfaces';

const DEFAULT_CAPABILITIES: IPluginApiCapabilities = {
  listSupported: true,
  detailSupported: true,
  saveConfigSupported: true,
  detailFallbackToList: false,
};

const UNSUPPORTED_JSON_SCHEMA_KEYWORDS = new Set([
  'oneOf',
  'anyOf',
  'allOf',
  'if',
  'then',
  'else',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  '$ref',
  'not',
  'patternProperties',
  'contains',
]);

/**
 * Signal K plugin configuration foundation service.
 *
 * Scope:
 * - Plugin detection/state/configuration only (no install/uninstall flow).
 * - Uses Signal K Apps plugin endpoints: GET /plugins, GET /plugins/{id}, POST /plugins/{id}/config.
 * - Normalizes optional JSON schema into a core field model for future schema-driven forms.
 * - Preserves unknown configuration keys when persisting partial edits.
 *
 * Integration contract:
 * - Returns typed API results with normalized capability and error states.
 * - Leaves UI concerns (toasts, dialogs) to callers.
 */
@Injectable({ providedIn: 'root' })
export class SignalkPluginConfigService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(SignalKConnectionService);

  /**
   * Reactive capabilities state for the plugin REST surface.
   *
   * Purpose:
   * - Exposes discovered support status for plugin list/detail/config-save operations.
   * - Allows UI and consumers to gate functionality when a server lacks certain endpoints.
   *
   * Example:
   * ```ts
   * const caps = pluginConfigService.capabilities();
   * if (!caps.saveConfigSupported) {
   *   // disable save button in UI
   * }
   * ```
   */
  public readonly capabilities = signal<IPluginApiCapabilities>(DEFAULT_CAPABILITIES);

  /**
   * Detects plugin API capabilities against the currently connected Signal K server.
   *
   * Purpose:
   * - Probes plugin list and detail support.
   * - Returns normalized capability flags for caller-side feature gating.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - Promise resolving to `IPluginApiCapabilities`.
   *
   * Example:
   * ```ts
   * const capabilities = await pluginConfigService.detectCapabilities();
   * if (!capabilities.detailSupported && capabilities.detailFallbackToList) {
   *   console.log('Using /plugins list as detail fallback');
   * }
   * ```
   */
  public async detectCapabilities(): Promise<IPluginApiCapabilities> {
    const listResult = await this.listPlugins();
    if (!listResult.ok) {
      return listResult.capabilities;
    }

    const plugins = listResult.data;
    if (plugins.length === 0) {
      return listResult.capabilities;
    }

    const detailResult = await this.getPlugin(plugins[0].id);
    return detailResult.capabilities;
  }

  /**
   * Lists installed plugins from the Signal K server.
   *
   * Purpose:
   * - Fetches `GET /plugins`.
   * - Normalizes raw payloads into `ISignalkPlugin` domain objects.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<ISignalkPlugin[]>`.
   *
   * Example:
   * ```ts
   * const result = await pluginConfigService.listPlugins();
   * if (result.ok) {
   *   result.data.forEach(plugin => console.log(plugin.id, plugin.state.enabled));
   * }
   * ```
   */
  public async listPlugins(): Promise<IPluginApiResult<ISignalkPlugin[]>> {
    try {
      const plugins = await lastValueFrom(
        this.http.get<IRawPluginInformation[]>(this.toServerUrl('/plugins'))
      );
      const normalized = plugins.map(plugin => this.normalizePlugin(plugin));
      return this.success(normalized, { ...this.capabilities(), listSupported: true });
    } catch (error) {
      return this.handleHttpError(error, this.capabilities(), { listSupported: false });
    }
  }

  /**
   * Retrieves one plugin by id.
   *
   * Purpose:
   * - Attempts `GET /plugins/{id}` first.
   * - Falls back to list-derived detail when detail endpoint is unavailable.
   *
   * Parameters:
   * - `pluginId`: Target plugin identifier.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<ISignalkPlugin>`.
   *
   * Example:
   * ```ts
   * const plugin = await pluginConfigService.getPlugin('autopilot');
   * if (plugin.ok) {
   *   console.log(plugin.data.name, plugin.data.state.enabled);
   * }
   * ```
   */
  public async getPlugin(pluginId: string): Promise<IPluginApiResult<ISignalkPlugin>> {
    try {
      const detail = await lastValueFrom(
        this.http.get<IRawPluginDetail>(this.toServerUrl(`/plugins/${encodeURIComponent(pluginId)}`))
      );

      const fromList = await this.findPluginFromList(pluginId);
      if (fromList) {
        return this.success(
          {
            ...fromList,
            state: {
              ...fromList.state,
              enabled: detail.enabled,
            },
          },
          { ...this.capabilities(), detailSupported: true }
        );
      }

      return this.success(
        {
          id: detail.id,
          name: detail.name,
          packageName: detail.id,
          version: detail.version,
          description: '',
          keywords: [],
          statusMessage: null,
          schema: null,
          state: {
            configuration: {},
            enabled: detail.enabled,
            enableDebug: false,
            enableLogging: false,
          },
        },
        { ...this.capabilities(), detailSupported: true }
      );
    } catch (error) {
      if (this.isHttpStatus(error, 404)) {
        const fallback = await this.findPluginFromList(pluginId);
        if (fallback) {
          return this.success(fallback, {
            ...this.capabilities(),
            detailSupported: false,
            detailFallbackToList: true,
          });
        }
      }

      return this.handleHttpError(error, this.capabilities(), { detailSupported: false });
    }
  }

  /**
   * Gets only configuration state for a plugin.
   *
   * Purpose:
   * - Provides a narrower state payload for callers that only need config flags + object.
   *
   * Parameters:
   * - `pluginId`: Target plugin identifier.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<IPluginConfigState>`.
   *
   * Example:
   * ```ts
   * const cfg = await pluginConfigService.getPluginConfig('autopilot');
   * if (cfg.ok) {
   *   console.log(cfg.data.configuration);
   * }
   * ```
   */
  public async getPluginConfig(pluginId: string): Promise<IPluginApiResult<IPluginConfigState>> {
    const pluginResult = await this.getPlugin(pluginId);
    if (this.isFailure(pluginResult)) {
      return this.failure(pluginResult);
    }
    return this.success(pluginResult.data.state, pluginResult.capabilities);
  }

  /**
   * Saves plugin configuration and runtime flags.
   *
   * Purpose:
   * - Merges incoming config patch with existing server configuration.
   * - Preserves unknown keys not included in the patch.
   * - Persists through `POST /plugins/{id}/config`.
   *
   * Parameters:
   * - `pluginId`: Target plugin identifier.
   * - `request`: Config/state patch payload.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<IPluginConfigSaveResult>`.
   *
   * Example:
   * ```ts
   * const saved = await pluginConfigService.savePluginConfig('autopilot', {
   *   configuration: { mode: 'wind' },
   *   enableLogging: true
   * });
   * if (saved.ok) {
   *   console.log(saved.data.state.configuration);
   * }
   * ```
   */
  public async savePluginConfig(pluginId: string, request: IPluginConfigSaveRequest): Promise<IPluginApiResult<IPluginConfigSaveResult>> {
    const pluginResult = await this.getPlugin(pluginId);
    if (this.isFailure(pluginResult)) {
      return this.failure(pluginResult);
    }

    const plugin = pluginResult.data;
    const payload: IPluginConfigState = {
      configuration: {
        ...(plugin.state.configuration || {}),
        ...(request.configuration || {}),
      },
      enabled: request.enabled ?? plugin.state.enabled,
      enableDebug: request.enableDebug ?? plugin.state.enableDebug,
      enableLogging: request.enableLogging ?? plugin.state.enableLogging,
    };

    try {
      await lastValueFrom(
        this.http.post(this.toServerUrl(`/plugins/${encodeURIComponent(pluginId)}/config`), payload)
      );
      return this.success(
        {
          pluginId,
          state: payload,
        },
        { ...pluginResult.capabilities, saveConfigSupported: true }
      );
    } catch (error) {
      return this.handleHttpError(error, pluginResult.capabilities, { saveConfigSupported: false });
    }
  }

  /**
   * Convenience helper to enable/disable a plugin while preserving existing configuration.
   *
   * Purpose:
   * - Updates only the `enabled` state through the same persistence pipeline.
   *
   * Parameters:
   * - `pluginId`: Target plugin identifier.
   * - `enabled`: Desired plugin enabled state.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<IPluginConfigSaveResult>`.
   *
   * Example:
   * ```ts
   * await pluginConfigService.setPluginEnabled('autopilot', true);
   * ```
   */
  public async setPluginEnabled(pluginId: string, enabled: boolean): Promise<IPluginApiResult<IPluginConfigSaveResult>> {
    return this.savePluginConfig(pluginId, {
      configuration: {},
      enabled,
    });
  }

  /**
   * Validates that a plugin dependency requirement is satisfied.
   *
   * Purpose:
   * - Checks presence, enabled state, and optional required config key/values.
   * - Produces normalized status (`ready`, `missing`, `disabled`, `config-mismatch`).
   *
   * Parameters:
   * - `requirement`: Dependency requirement descriptor.
   *
   * Returns:
   * - Promise resolving to `IPluginApiResult<IPluginDependencyValidationResult>`.
   *
   * Example:
   * ```ts
   * const validation = await pluginConfigService.validateDependency({
   *   pluginId: 'autopilot',
   *   requireEnabled: true,
   *   requiredConfig: { provider: 'pypilot' }
   * });
   * if (validation.ok && validation.data.status !== 'ready') {
   *   console.log(validation.data.status, validation.data.missingKeys);
   * }
   * ```
   */
  public async validateDependency(requirement: IPluginDependencyRequirement): Promise<IPluginApiResult<IPluginDependencyValidationResult>> {
    const pluginResult = await this.getPlugin(requirement.pluginId);
    if (this.isFailure(pluginResult)) {
      if (pluginResult.error.reason === 'not-found') {
        return this.success(
          {
            status: 'missing',
            pluginId: requirement.pluginId,
          },
          pluginResult.capabilities
        );
      }
      return this.failure(pluginResult);
    }

    const plugin = pluginResult.data;
    const requireEnabled = requirement.requireEnabled ?? true;
    if (requireEnabled && !plugin.state.enabled) {
      return this.success(
        {
          status: 'disabled',
          pluginId: requirement.pluginId,
          plugin,
        },
        pluginResult.capabilities
      );
    }

    const missingKeys = this.getConfigMismatchKeys(
      requirement.requiredConfig,
      plugin.state.configuration
    );

    if (missingKeys.length > 0) {
      return this.success(
        {
          status: 'config-mismatch',
          pluginId: requirement.pluginId,
          plugin,
          missingKeys,
        },
        pluginResult.capabilities
      );
    }

    return this.success(
      {
        status: 'ready',
        pluginId: requirement.pluginId,
        plugin,
      },
      pluginResult.capabilities
    );
  }

  /**
   * Normalizes a plugin JSON schema into a form-friendly field model.
   *
   * Purpose:
   * - Extracts core field metadata for a schema-driven form service.
   * - Flags unsupported JSON Schema keywords for graceful fallback handling.
   *
   * Parameters:
   * - `schema`: Raw schema object from plugin metadata.
   *
   * Returns:
   * - `IPluginSchemaNormalization` with field descriptors and support flags.
   *
   * Example:
   * ```ts
   * const normalized = pluginConfigService.normalizePluginSchema(plugin.schema);
   * if (!normalized.supported) {
   *   console.warn('Fallback to basic editor', normalized.unsupportedKeywords);
   * }
   * ```
   */
  public normalizePluginSchema(schema: unknown): IPluginSchemaNormalization {
    if (!schema || typeof schema !== 'object') {
      return {
        hasSchema: false,
        supported: false,
        fields: [],
        unsupportedKeywords: [],
      };
    }

    const schemaObj = schema as Record<string, unknown>;
    const unsupportedKeywords = Object.keys(schemaObj).filter(key => UNSUPPORTED_JSON_SCHEMA_KEYWORDS.has(key));

    const required = new Set(
      Array.isArray(schemaObj['required'])
        ? (schemaObj['required'] as unknown[]).filter(value => typeof value === 'string') as string[]
        : []
    );

    const properties = (schemaObj['properties'] && typeof schemaObj['properties'] === 'object')
      ? schemaObj['properties'] as Record<string, unknown>
      : {};

    const fields = Object.entries(properties).map(([key, value]) => this.toSchemaField(key, value, required.has(key)));

    return {
      hasSchema: true,
      supported: unsupportedKeywords.length === 0,
      fields,
      unsupportedKeywords,
    };
  }

  private async findPluginFromList(pluginId: string): Promise<ISignalkPlugin | null> {
    const listResult = await this.listPlugins();
    if (!listResult.ok) {
      return null;
    }

    return listResult.data.find(plugin => plugin.id === pluginId) ?? null;
  }

  private normalizePlugin(raw: IRawPluginInformation): ISignalkPlugin {
    return {
      id: raw.id,
      name: raw.name,
      packageName: raw.packageName,
      version: raw.version,
      description: raw.description,
      keywords: raw.keywords ?? [],
      statusMessage: raw.statusMessage ?? null,
      schema: raw.schema ?? null,
      state: {
        configuration: raw.data?.configuration ?? {},
        enabled: raw.data?.enabled ?? false,
        enableLogging: raw.data?.enableLogging ?? false,
        enableDebug: raw.data?.enableDebug ?? false,
      },
    };
  }

  private toSchemaField(key: string, definition: unknown, required: boolean): IPluginSchemaField {
    if (!definition || typeof definition !== 'object') {
      return {
        key,
        type: 'unknown',
        required,
        unsupportedKeywords: [],
      };
    }

    const defObj = definition as Record<string, unknown>;
    const typeValue = typeof defObj['type'] === 'string' ? defObj['type'] : 'unknown';
    const unsupportedKeywords = Object.keys(defObj).filter(entry => UNSUPPORTED_JSON_SCHEMA_KEYWORDS.has(entry));

    return {
      key,
      type: this.normalizeSchemaType(typeValue),
      required,
      title: typeof defObj['title'] === 'string' ? defObj['title'] : undefined,
      description: typeof defObj['description'] === 'string' ? defObj['description'] : undefined,
      enumValues: Array.isArray(defObj['enum']) ? defObj['enum'] : undefined,
      defaultValue: defObj['default'],
      minimum: typeof defObj['minimum'] === 'number' ? defObj['minimum'] : undefined,
      maximum: typeof defObj['maximum'] === 'number' ? defObj['maximum'] : undefined,
      pattern: typeof defObj['pattern'] === 'string' ? defObj['pattern'] : undefined,
      unsupportedKeywords,
    };
  }

  private normalizeSchemaType(type: string): IPluginSchemaField['type'] {
    if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean' || type === 'array' || type === 'object') {
      return type;
    }
    return 'unknown';
  }

  private toServerUrl(path: string): string {
    const configuredUrl = this.connection.signalKURL?.url?.trim();
    if (!configuredUrl) {
      return path;
    }

    const base = configuredUrl.endsWith('/') ? configuredUrl.slice(0, -1) : configuredUrl;
    return `${base}${path}`;
  }

  private getConfigMismatchKeys(requiredConfig: Record<string, unknown> | undefined, currentConfig: Record<string, unknown>): string[] {
    if (!requiredConfig) {
      return [];
    }

    return Object.entries(requiredConfig)
      .filter(([key, value]) => !this.deepEquals(currentConfig?.[key], value))
      .map(([key]) => key);
  }

  private deepEquals(left: unknown, right: unknown): boolean {
    if (left === right) {
      return true;
    }

    if (typeof left !== typeof right) {
      return false;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false;
      }
      return left.every((item, index) => this.deepEquals(item, right[index]));
    }

    if (left && right && typeof left === 'object' && typeof right === 'object') {
      const leftObj = left as Record<string, unknown>;
      const rightObj = right as Record<string, unknown>;
      const keys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
      for (const key of keys) {
        if (!this.deepEquals(leftObj[key], rightObj[key])) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private success<T>(data: T, capabilities: IPluginApiCapabilities): IPluginApiResult<T> {
    this.capabilities.set(capabilities);
    return {
      ok: true,
      data,
      capabilities,
    };
  }

  private failure<T>(failure: IPluginApiFailure): IPluginApiResult<T> {
    return {
      ok: false,
      error: failure.error,
      capabilities: failure.capabilities,
    };
  }

  private isFailure<T>(result: IPluginApiResult<T>): result is IPluginApiFailure {
    return result.ok === false;
  }

  private handleHttpError<T>(
    error: unknown,
    currentCapabilities: IPluginApiCapabilities,
    capabilityPatch: Partial<IPluginApiCapabilities> = {}
  ): IPluginApiResult<T> {
    const capabilities = {
      ...currentCapabilities,
      ...capabilityPatch,
    };

    const mapped = this.mapError(error);
    this.capabilities.set(capabilities);

    return {
      ok: false,
      error: mapped,
      capabilities,
    };
  }

  private mapError(error: unknown): IPluginApiError {
    if (!(error instanceof HttpErrorResponse)) {
      return {
        reason: 'unknown',
        message: '[Plugin Config Service] Unknown error while calling plugin API',
      };
    }

    if (error.status === 0) {
      return {
        reason: 'network-failure',
        statusCode: error.status,
        message: '[Plugin Config Service] Network error while calling plugin API',
      };
    }

    if (error.status === 401) {
      return {
        reason: 'auth-required',
        statusCode: 401,
        message: '[Plugin Config Service] Authentication required',
      };
    }

    if (error.status === 403) {
      return {
        reason: 'forbidden',
        statusCode: 403,
        message: '[Plugin Config Service] Access forbidden for plugin API',
      };
    }

    if (error.status === 404) {
      return {
        reason: 'not-found',
        statusCode: 404,
        message: '[Plugin Config Service] Plugin endpoint or resource not found',
      };
    }

    if (error.status === 405 || error.status === 501) {
      return {
        reason: 'capability-unsupported',
        statusCode: error.status,
        message: '[Plugin Config Service] Plugin API capability is not supported by this server',
      };
    }

    if (error.status >= 500) {
      return {
        reason: 'server-error',
        statusCode: error.status,
        message: '[Plugin Config Service] Server error while calling plugin API',
      };
    }

    return {
      reason: 'unknown',
      statusCode: error.status,
      message: '[Plugin Config Service] Unexpected plugin API error',
    };
  }

  private isHttpStatus(error: unknown, status: number): boolean {
    return error instanceof HttpErrorResponse && error.status === status;
  }
}
