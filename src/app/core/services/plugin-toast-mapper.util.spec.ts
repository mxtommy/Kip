import {
  mapDependencyValidationToToast,
  mapPluginErrorToToast,
  mapPluginToastOutcome
} from './plugin-toast-mapper.util';

describe('Plugin toast mapper', () => {
  it('should map explicit outcomes to matrix keys and severities', () => {
    const mapped = mapPluginToastOutcome('config-save-success');
    expect(mapped.messageKey).toBe('plugins.config.saveSuccess');
    expect(mapped.severity).toBe('success');
  });

  it('should map API auth errors to auth toast keys', () => {
    const mapped = mapPluginErrorToToast({
      reason: 'auth-required',
      message: 'Authentication required',
      statusCode: 401
    });

    expect(mapped.messageKey).toBe('plugins.auth.required');
    expect(mapped.severity).toBe('warn');
  });

  it('should map dependency disabled status to warning toast', () => {
    const mapped = mapDependencyValidationToToast({
      status: 'disabled',
      pluginId: 'autopilot'
    });

    expect(mapped?.messageKey).toBe('plugins.dependency.disabled');
    expect(mapped?.severity).toBe('warn');
  });

  it('should return null for ready dependency status', () => {
    const mapped = mapDependencyValidationToToast({
      status: 'ready',
      pluginId: 'autopilot'
    });

    expect(mapped).toBeNull();
  });
});
