import { SnackItem } from './toast.service';
import { IPluginApiError, IPluginDependencyValidationResult } from '../interfaces/signalk-plugin-config.interfaces';

/**
 * Supported toast mapping outcomes for plugin management workflows.
 *
 * Purpose:
 * - Defines canonical outcome keys used to map domain/API events to toast message keys and severities.
 *
 * Example:
 * ```ts
 * const outcome: TPluginToastOutcome = 'config-save-success';
 * ```
 */
export type TPluginToastOutcome =
  | 'capability-unsupported'
  | 'auth-required'
  | 'auth-forbidden'
  | 'plugin-not-found'
  | 'plugin-disabled'
  | 'config-mismatch'
  | 'config-invalid-client'
  | 'config-save-success'
  | 'plugin-enable-success'
  | 'plugin-disable-success'
  | 'config-save-failed-5xx'
  | 'network-failure-timeout';

const TOAST_KEY_BY_OUTCOME: Record<TPluginToastOutcome, string> = {
  'capability-unsupported': 'plugins.capability.unsupported',
  'auth-required': 'plugins.auth.required',
  'auth-forbidden': 'plugins.auth.forbidden',
  'plugin-not-found': 'plugins.dependency.missing',
  'plugin-disabled': 'plugins.dependency.disabled',
  'config-mismatch': 'plugins.config.mismatch',
  'config-invalid-client': 'plugins.config.invalid',
  'config-save-success': 'plugins.config.saveSuccess',
  'plugin-enable-success': 'plugins.state.enableSuccess',
  'plugin-disable-success': 'plugins.state.disableSuccess',
  'config-save-failed-5xx': 'plugins.config.saveFailedServer',
  'network-failure-timeout': 'plugins.network.failure',
};

const TOAST_SEVERITY_BY_OUTCOME: Record<TPluginToastOutcome, NonNullable<SnackItem['severity']>> = {
  'capability-unsupported': 'warn',
  'auth-required': 'warn',
  'auth-forbidden': 'error',
  'plugin-not-found': 'error',
  'plugin-disabled': 'warn',
  'config-mismatch': 'warn',
  'config-invalid-client': 'warn',
  'config-save-success': 'success',
  'plugin-enable-success': 'success',
  'plugin-disable-success': 'success',
  'config-save-failed-5xx': 'error',
  'network-failure-timeout': 'error',
};

export interface IPluginToastMessage {
  /**
   * Canonical outcome identifier that produced this toast mapping.
   *
   * Purpose:
   * - Keeps a traceable link between domain outcome and final UI notification payload.
   *
   * Example:
   * ```ts
   * const outcome = toastMessage.outcome;
   * ```
   */
  outcome: TPluginToastOutcome;
  /**
   * Translation/message key consumed by UI notification rendering.
   *
   * Purpose:
   * - Decouples domain mapping from localized message content.
   *
   * Example:
   * ```ts
   * toastService.show(toastMessage.messageKey, 2500, true, 'Dismiss', toastMessage.severity);
   * ```
   */
  messageKey: string;
  /**
   * Toast severity level aligned with ToastService snackbar style variants.
   *
   * Purpose:
   * - Drives visual semantics for mapped notifications.
   *
   * Example:
   * ```ts
   * if (toastMessage.severity === 'error') {
   *   // prioritize display path if needed
   * }
   * ```
   */
  severity: NonNullable<SnackItem['severity']>;
}

/**
 * Maps a known plugin outcome into toast message metadata.
 *
 * Purpose:
 * - Converts normalized outcome keys to UI-ready `messageKey` and `severity` values.
 *
 * Parameters:
 * - `outcome`: Canonical plugin toast outcome.
 *
 * Returns:
 * - `IPluginToastMessage` payload for notification display.
 *
 * Example:
 * ```ts
 * const toastMessage = mapPluginToastOutcome('plugin-enable-success');
 * toastService.show(toastMessage.messageKey, 2000, true, 'Dismiss', toastMessage.severity);
 * ```
 */
export function mapPluginToastOutcome(outcome: TPluginToastOutcome): IPluginToastMessage {
  return {
    outcome,
    messageKey: TOAST_KEY_BY_OUTCOME[outcome],
    severity: TOAST_SEVERITY_BY_OUTCOME[outcome],
  };
}

/**
 * Maps a normalized plugin API error to toast message metadata.
 *
 * Purpose:
 * - Converts transport/domain error reasons into consistent user-facing notification semantics.
 *
 * Parameters:
 * - `error`: Normalized plugin API error object.
 *
 * Returns:
 * - `IPluginToastMessage` describing the mapped error notification.
 *
 * Example:
 * ```ts
 * const result = await pluginConfigService.savePluginConfig('autopilot', payload);
 * if (!result.ok) {
 *   const toastMessage = mapPluginErrorToToast(result.error);
 *   toastService.show(toastMessage.messageKey, 3000, true, 'Dismiss', toastMessage.severity);
 * }
 * ```
 */
export function mapPluginErrorToToast(error: IPluginApiError): IPluginToastMessage {
  switch (error.reason) {
    case 'auth-required':
      return mapPluginToastOutcome('auth-required');
    case 'forbidden':
      return mapPluginToastOutcome('auth-forbidden');
    case 'not-found':
      return mapPluginToastOutcome('plugin-not-found');
    case 'capability-unsupported':
      return mapPluginToastOutcome('capability-unsupported');
    case 'network-failure':
      return mapPluginToastOutcome('network-failure-timeout');
    case 'server-error':
      return mapPluginToastOutcome('config-save-failed-5xx');
    default:
      return mapPluginToastOutcome('config-invalid-client');
  }
}

/**
 * Maps plugin dependency validation state to optional toast metadata.
 *
 * Purpose:
 * - Produces toasts for non-ready dependency states while suppressing notifications for ready state.
 *
 * Parameters:
 * - `validation`: Dependency validation result from plugin config service.
 *
 * Returns:
 * - `IPluginToastMessage` for non-ready states, otherwise `null`.
 *
 * Example:
 * ```ts
 * const validation = await pluginConfigService.validateDependency({ pluginId: 'autopilot' });
 * if (validation.ok) {
 *   const toastMessage = mapDependencyValidationToToast(validation.data);
 *   if (toastMessage) {
 *     toastService.show(toastMessage.messageKey, 2500, true, 'Dismiss', toastMessage.severity);
 *   }
 * }
 * ```
 */
export function mapDependencyValidationToToast(validation: IPluginDependencyValidationResult): IPluginToastMessage | null {
  if (validation.status === 'disabled') {
    return mapPluginToastOutcome('plugin-disabled');
  }

  if (validation.status === 'config-mismatch') {
    return mapPluginToastOutcome('config-mismatch');
  }

  if (validation.status === 'missing') {
    return mapPluginToastOutcome('plugin-not-found');
  }

  return null;
}
