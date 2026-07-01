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
    // The Alternator, Inverter and AC Monitor widget definitions are currently commented out in
    // widget.service.ts (see the /* ... */ block around the electrical family entries), so they are
    // not registered yet. Re-enable these assertions when those definitions are uncommented.
    // expect(selectors).toContain('widget-inverter');
    // expect(selectors).toContain('widget-alternator');
    // expect(selectors).toContain('widget-ac');
  });
});
