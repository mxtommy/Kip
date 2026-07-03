import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

const { bootstrapApplicationMock } = vi.hoisted(() => ({
  bootstrapApplicationMock: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@angular/platform-browser', async () => {
  const actual = await vi.importActual<typeof import('@angular/platform-browser')>('@angular/platform-browser');
  return {
    ...actual,
    bootstrapApplication: bootstrapApplicationMock,
  };
});

describe('main startup chart plugin registration', () => {
  beforeEach(() => {
    vi.resetModules();
    bootstrapApplicationMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers annotation plugin at startup via Chart.register (inline plugin registration not supported as of annotation 3.0.1)', async () => {
    const registerSpy = vi.spyOn(Chart, 'register');

    await import('./main');

    expect(registerSpy).toHaveBeenCalled();
    const registeredItems = registerSpy.mock.calls.flat();
    expect(registeredItems).toContain(annotationPlugin);
    expect(bootstrapApplicationMock).toHaveBeenCalledTimes(1);
  });
});
