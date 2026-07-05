import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { GaugeSteelComponent } from './gauge-steel.component';
import { UnitsService } from '../../core/services/units.service';

describe('GaugeSteelComponent', () => {
  let component: GaugeSteelComponent;
  let fixture: ComponentFixture<GaugeSteelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GaugeSteelComponent],
      providers: [
        {
          provide: UnitsService,
          useValue: {
            convertToUnit: (_unit: string, value: number) => value,
          },
        },
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GaugeSteelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('keeps latest measured size across rebuild', () => {
    vi.useFakeTimers();

    const resizeEntry = {
      contentRect: { width: 420, height: 180 },
    } as ResizeObserverEntry;

    component.onResized(resizeEntry);
    vi.runAllTimers();

    const gaugeOptions = (component as unknown as { gaugeOptions: Record<string, unknown> }).gaugeOptions;
    expect(gaugeOptions.width).toBe(420);
    expect(gaugeOptions.height).toBe(180);
  });
});
