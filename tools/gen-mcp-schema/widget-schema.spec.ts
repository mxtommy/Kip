import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { extractWidgetSchemas } from './generate';
import type { WidgetSchemaEntry } from './types';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemas = extractWidgetSchemas({ projectRoot });
const bySelector = (selector: string): WidgetSchemaEntry | undefined =>
  schemas.find((w) => w.selector === selector);

describe('extractWidgetSchemas', () => {
  it('extracts a DEFAULT_CONFIG object for every catalog widget', () => {
    expect(schemas.length).toBeGreaterThanOrEqual(30);
    for (const widget of schemas) {
      expect(widget.defaultConfig, widget.selector).toBeTypeOf('object');
      expect(widget.defaultConfig, widget.selector).not.toBeNull();
    }
  });

  it('classifies bindingKind structurally from DEFAULT_CONFIG', () => {
    expect(bySelector('widget-numeric')?.bindingKind).toBe('paths-record');
    expect(bySelector('widget-wind-steer')?.bindingKind).toBe('paths-record');
    expect(bySelector('widget-boolean-switch')?.bindingKind).toBe('paths-array');
    expect(bySelector('widget-zones-state-panel')?.bindingKind).toBe('paths-array');
    expect(bySelector('widget-data-chart')?.bindingKind).toBe('datachart');
    expect(bySelector('widget-windtrends-chart')?.bindingKind).toBe('none');
    expect(bySelector('widget-bms')?.bindingKind).toBe('none');
  });

  it('extracts path slots for a record-bound widget (numeric)', () => {
    const numericPath = bySelector('widget-numeric')?.pathSlots.find((s) => s.slot === 'numericPath');
    expect(numericPath).toMatchObject({
      slot: 'numericPath',
      defaultPath: null,
      pathType: 'number',
      isPathConfigurable: true,
      pathRequired: false,
      defaultConvertUnitTo: 'unitless',
      expectedSkUnit: null,
      sampleTime: 500,
    });
  });

  it('captures default-bound, required slots (wind-steer heading)', () => {
    const heading = bySelector('widget-wind-steer')?.pathSlots.find((s) => s.slot === 'headingPath');
    expect(heading).toMatchObject({
      defaultPath: 'self.navigation.headingTrue',
      pathRequired: true,
      expectedSkUnit: 'rad',
      defaultConvertUnitTo: 'deg',
    });
  });

  it('gives non-record widgets no path slots', () => {
    expect(bySelector('widget-data-chart')?.pathSlots).toEqual([]);
    expect(bySelector('widget-boolean-switch')?.pathSlots).toEqual([]);
    expect(bySelector('widget-bms')?.pathSlots).toEqual([]);
  });

  it('keeps a widget special config object verbatim (bms)', () => {
    const config = bySelector('widget-bms')?.defaultConfig as { bms?: unknown };
    expect(config.bms).toMatchObject({ trackedDevices: [], groups: [], banks: [] });
  });
});
