import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildSchema } from './generate';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const schema = buildSchema({ projectRoot });

describe('buildSchema', () => {
  it('stamps meta with the KIP version and config versions', () => {
    expect(schema.meta).toMatchObject({
      schemaVersion: 1,
      configFileVersion: 11,
      configVersion: 12,
    });
    expect(schema.meta.kipVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('includes the widget schemas and the design system', () => {
    expect(schema.widgets.length).toBeGreaterThanOrEqual(30);
    expect(schema.widgets.some((w) => w.selector === 'widget-numeric')).toBe(true);
    expect(schema.designSystem.grid.column).toBe(24);
    expect(schema.designSystem.colors).toHaveLength(8);
  });
});
