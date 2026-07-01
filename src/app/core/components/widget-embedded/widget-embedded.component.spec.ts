import { Component, Type, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { WidgetEmbeddedComponent } from './widget-embedded.component';
import { WidgetService } from '../../services/widget.service';
import { AppService } from '../../services/app-service';
import { DataService } from '../../services/data.service';
import { UnitsService } from '../../services/units.service';
import type { IWidget } from '../../interfaces/widgets-interface';

// A trivial stand-in widget the embedded host will lazy-load and render.
@Component({
  selector: 'test-lazy-widget',
  standalone: true,
  template: '<span class="test-lazy-widget">loaded</span>'
})
class TestLazyWidgetComponent {
  public id = input<string>();
  public type = input<string>();
  public theme = input<unknown>();
  public static readonly DEFAULT_CONFIG = { displayName: 'Test' };
}

describe('WidgetEmbeddedComponent', () => {
  let fixture: ComponentFixture<WidgetEmbeddedComponent>;
  const getComponentType = vi.fn();

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetEmbeddedComponent],
      providers: [
        { provide: WidgetService, useValue: { getComponentType, getDefaultConfig: vi.fn().mockReturnValue(undefined) } },
        { provide: AppService, useValue: { cssThemeColorRoles$: of({ contrast: '#fff' }) } },
        // Mocked so the streams/metadata host directives don't construct the real DataService chain.
        { provide: DataService, useValue: {} },
        { provide: UnitsService, useValue: { convertToUnit: (_u: string, v: unknown) => v } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetEmbeddedComponent);
    fixture.componentRef.setInput('widgetProperties', {
      uuid: 'embedded-1',
      type: 'test-lazy-widget',
      config: {}
    } as IWidget);
  };

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('lazily resolves the widget component and renders it once the chunk loads', async () => {
    getComponentType.mockResolvedValue(TestLazyWidgetComponent as Type<unknown>);
    await setup();

    fixture.detectChanges(); // ngOnInit kicks off the async load
    // Not rendered synchronously: resolution is async (the import has not resolved yet).
    expect(fixture.nativeElement.querySelector('.test-lazy-widget')).toBeNull();

    await fixture.whenStable();
    fixture.detectChanges();

    // After the (mocked) import resolves, the child widget is created and rendered.
    expect(getComponentType).toHaveBeenCalledWith('test-lazy-widget');
    expect(fixture.nativeElement.querySelector('.test-lazy-widget')?.textContent).toContain('loaded');
  });

  it('does not create a child when the component type fails to resolve', async () => {
    getComponentType.mockResolvedValue(undefined);
    await setup();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.test-lazy-widget')).toBeNull();
  });
});
