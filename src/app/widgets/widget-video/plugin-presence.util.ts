import type {
  IPluginApiResult,
  ISignalkPlugin,
} from '../../core/interfaces/signalk-plugin-config.interfaces';

/** Whether a required Signal K plugin can actually be used right now. */
export type TPluginPresence = 'unknown' | 'present' | 'missing';

/**
 * Classify a `getPlugin()` result into whether the plugin is usable.
 *
 * - installed + enabled → 'present'
 * - installed but disabled, or a definitive "not found" (404) → 'missing'
 * - anything inconclusive (auth-required, network failure, server error…) → 'unknown'
 *
 * Treating only a definitive not-found/disabled as 'missing' avoids wrongly telling the user to
 * install a plugin that may simply be unreachable or that they lack the rights to query.
 */
export function classifyPluginPresence(res: IPluginApiResult<ISignalkPlugin>): TPluginPresence {
  if (res.ok) {
    return res.data.state.enabled ? 'present' : 'missing';
  }
  // The `'error' in res` guard is load-bearing: the compiler doesn't narrow this union on `ok`.
  const reason = 'error' in res ? res.error.reason : 'unknown';
  return reason === 'not-found' ? 'missing' : 'unknown';
}
