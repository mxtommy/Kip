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
});
