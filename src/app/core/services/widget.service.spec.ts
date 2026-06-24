import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetService } from './widget.service';

describe('WidgetService', () => {
  let service: WidgetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WidgetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('registers new electrical family widgets in definitions', () => {
    const selectors = service.kipWidgets.map(widget => widget.selector);

    expect(selectors).toContain('widget-charger');
    expect(selectors).toContain('widget-inverter');
    expect(selectors).toContain('widget-alternator');
    expect(selectors).toContain('widget-ac');
  });

  it('lazily resolves a component type as a promise and dedupes concurrent lookups', async () => {
    const p1 = service.getComponentType('widget-text');
    const p2 = service.getComponentType('widget-text');
    expect(p1).toBeInstanceOf(Promise);
    expect(p1).toBe(p2); // same in-flight promise reused (single import())

    const type = await p1;
    expect(type).toBeTruthy();
  });

  it('resolves undefined for an unknown selector without attempting an import', async () => {
    await expect(service.getComponentType('widget-does-not-exist')).resolves.toBeUndefined();
  });

  it('exposes DEFAULT_CONFIG only after the component has been loaded', async () => {
    // Not fetched yet: config-only consumers get undefined and fall back to saved config.
    expect(service.getDefaultConfig('widget-text')).toBeUndefined();

    await service.getComponentType('widget-text');

    // Once the chunk has loaded, the static DEFAULT_CONFIG is cached for synchronous reads.
    expect(service.getDefaultConfig('widget-text')).toBeDefined();
  });
});
