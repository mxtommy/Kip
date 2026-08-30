import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { extractDesignSystem } from './generate';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const design = extractDesignSystem({ projectRoot });

describe('extractDesignSystem', () => {
  it('reads the 24-column grid geometry', () => {
    expect(design.grid).toMatchObject({
      column: 24,
      row: 24,
      margin: 4,
      float: true,
      cellHeight: 'auto',
    });
  });

  it('reads the colour tokens in palette order', () => {
    const values = design.colors.map((c) => c.value);
    expect(values).toEqual([
      'contrast',
      'blue',
      'green',
      'orange',
      'yellow',
      'pink',
      'purple',
      'grey',
    ]);
    expect(design.colors[0]).toEqual({ value: 'contrast', label: 'Contrast', hex: '#FFFFFF' });
    for (const c of design.colors) {
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it('lists the supported theme names', () => {
    expect(design.themeNames).toEqual(expect.arrayContaining(['', 'light-theme', 'night-theme']));
  });

  it('lists the dashboard icons, sorted and de-duplicated', () => {
    expect(design.icons.length).toBeGreaterThanOrEqual(40);
    expect(design.icons).toContain('dashboard-anchored-boat');
    expect(design.icons).toContain('dashboard-sailing');
    const sorted = [...design.icons].sort((a, b) => a.localeCompare(b));
    expect(design.icons).toEqual(sorted);
    expect(new Set(design.icons).size).toBe(design.icons.length);
  });

  it('reads unit groups with their convertible measures', () => {
    const speed = design.unitGroups.find((g) => g.group === 'Speed');
    expect(speed?.measures.map((m) => m.measure)).toEqual(
      expect.arrayContaining(['knots', 'kph', 'mph', 'm/s']),
    );
    const angle = design.unitGroups.find((g) => g.group === 'Angle');
    expect(angle?.measures.map((m) => m.measure)).toEqual(expect.arrayContaining(['rad', 'deg']));
  });
});
