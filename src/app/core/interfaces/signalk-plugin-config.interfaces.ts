export type TPluginValidationStatus = 'ready' | 'missing' | 'disabled' | 'config-mismatch';

export type TPluginApiErrorReason =
  | 'auth-required'
  | 'forbidden'
  | 'not-found'
  | 'capability-unsupported'
  | 'network-failure'
  | 'server-error'
  | 'validation-error'
  | 'unknown';

export interface IPluginConfigState {
  configuration: Record<string, unknown>;
  enabled: boolean;
  enableLogging: boolean;
  enableDebug: boolean;
}

export interface IRawPluginInformation {
  id: string;
  name: string;
  packageName: string;
  keywords: string[];
  version: string;
  description: string;
  schema: Record<string, unknown> | null;
  statusMessage?: string;
  data: IPluginConfigState;
}

export interface IRawPluginDetail {
  enabled: boolean;
  enabledByDefault?: boolean;
  id: string;
  name: string;
  version: string;
}

export interface ISignalkPlugin {
  id: string;
  name: string;
  packageName: string;
  version: string;
  description: string;
  keywords: string[];
  statusMessage: string | null;
  schema: Record<string, unknown> | null;
  state: IPluginConfigState;
}

export interface IPluginSchemaField {
  key: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'unknown';
  required: boolean;
  title?: string;
  description?: string;
  enumValues?: unknown[];
  defaultValue?: unknown;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  unsupportedKeywords: string[];
}

export interface IPluginSchemaNormalization {
  hasSchema: boolean;
  supported: boolean;
  fields: IPluginSchemaField[];
  unsupportedKeywords: string[];
}

export interface IPluginApiCapabilities {
  listSupported: boolean;
  detailSupported: boolean;
  saveConfigSupported: boolean;
  detailFallbackToList: boolean;
}

export interface IPluginApiError {
  reason: TPluginApiErrorReason;
  statusCode?: number;
  message: string;
}

export interface IPluginApiSuccess<T> {
  ok: true;
  data: T;
  capabilities: IPluginApiCapabilities;
}

export interface IPluginApiFailure {
  ok: false;
  error: IPluginApiError;
  capabilities: IPluginApiCapabilities;
}

export type IPluginApiResult<T> = IPluginApiSuccess<T> | IPluginApiFailure;

export interface IPluginConfigSaveRequest {
  configuration: Record<string, unknown>;
  enabled?: boolean;
  enableLogging?: boolean;
  enableDebug?: boolean;
}

export interface IPluginConfigSaveResult {
  pluginId: string;
  state: IPluginConfigState;
}

export interface IPluginDependencyRequirement {
  pluginId: string;
  requireEnabled?: boolean;
  requiredConfig?: Record<string, unknown>;
}

export interface IPluginDependencyValidationResult {
  status: TPluginValidationStatus;
  pluginId: string;
  plugin?: ISignalkPlugin;
  missingKeys?: string[];
}
