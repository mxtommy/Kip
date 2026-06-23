import { describe, it, expect } from 'vitest';
import { resolveBrowserTabTitle } from './browser-tab-title.util';

describe('resolveBrowserTabTitle (#1055)', () => {
  it('defaults to KIP when the value is missing or blank', () => {
    expect(resolveBrowserTabTitle(undefined)).toBe('KIP');
    expect(resolveBrowserTabTitle(null)).toBe('KIP');
    expect(resolveBrowserTabTitle('')).toBe('KIP');
    expect(resolveBrowserTabTitle('   ')).toBe('KIP');
  });

  it('uses the trimmed configured value when set', () => {
    expect(resolveBrowserTabTitle('Mast-KIP')).toBe('Mast-KIP');
    expect(resolveBrowserTabTitle('  Port Engine  ')).toBe('Port Engine');
  });
});
