import { describe, it, expect } from 'vitest';
import { classifyPluginPresence } from './plugin-presence.util';
import type {
  IPluginApiResult,
  ISignalkPlugin,
  TPluginApiErrorReason,
} from '../../core/interfaces/signalk-plugin-config.interfaces';

const caps = { listSupported: true, detailSupported: true, saveConfigSupported: true, detailFallbackToList: false };

function ok(enabled: boolean): IPluginApiResult<ISignalkPlugin> {
  return {
    ok: true,
    data: { state: { enabled } } as ISignalkPlugin,
    capabilities: caps,
  };
}
function fail(reason: TPluginApiErrorReason): IPluginApiResult<ISignalkPlugin> {
  return { ok: false, error: { reason, message: reason }, capabilities: caps };
}

describe('classifyPluginPresence', () => {
  it('installed and enabled is present', () => {
    expect(classifyPluginPresence(ok(true))).toBe('present');
  });

  it('installed but disabled is missing', () => {
    expect(classifyPluginPresence(ok(false))).toBe('missing');
  });

  it('a definitive not-found is missing', () => {
    expect(classifyPluginPresence(fail('not-found'))).toBe('missing');
  });

  it('inconclusive errors stay unknown (never a false "install me")', () => {
    for (const reason of ['auth-required', 'forbidden', 'network-failure', 'server-error', 'unknown'] as const) {
      expect(classifyPluginPresence(fail(reason))).toBe('unknown');
    }
  });
});
