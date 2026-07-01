import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetRaceTimerComponent } from './widget-race-timer.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { TimersService } from '../../core/services/timers.service';
import { CanvasService } from '../../core/services/canvas.service';
import type { ITheme } from '../../core/services/app-service';

const themeMock = {
  contrast: '#fff', dim: '#ccc', dimmer: '#999', color: '#fff',
  zoneNominal: '#0f0', zoneWarn: '#fa0', zoneAlarm: '#f00', zoneAlert: '#f0f'
} as unknown as ITheme;

// The 'race' timer is a shared singleton subject. ensureTimer() is invoked from the config effect
// (on every options() change) and from resetTimer(), so without lifecycle management each re-arm
// would stack another subscription on the same subject and none would be removed when the widget is
// destroyed. These tests pin that behaviour: exactly one active subscription, torn down on destroy.
describe('WidgetRaceTimerComponent timer subscription lifecycle', () => {
  let fixture: ComponentFixture<WidgetRaceTimerComponent>;
  let component: WidgetRaceTimerComponent;
  let timers: TimersService;

  const runtimeMock = { options: vi.fn() };
  const canvasMock = {
    registerCanvas: vi.fn(),
    unregisterCanvas: vi.fn(),
    clearCanvas: vi.fn(),
    calculateOptimalFontSize: vi.fn().mockReturnValue(10),
    drawRectangle: vi.fn(),
    drawText: vi.fn()
  };

  const setup = async (options: Record<string, unknown> = { timerLength: -300, color: 'contrast' }) => {
    runtimeMock.options.mockReturnValue(options);
    await TestBed.configureTestingModule({
      imports: [WidgetRaceTimerComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: CanvasService, useValue: canvasMock },
        TimersService
      ]
    }).compileComponents();

    timers = TestBed.inject(TimersService);
    fixture = TestBed.createComponent(WidgetRaceTimerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w-race-1');
    fixture.componentRef.setInput('type', 'widget-race-timer');
    fixture.componentRef.setInput('theme', themeMock);
    fixture.detectChanges();
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  const observerCount = (): number =>
    (timers as unknown as { kipTimers: Record<string, { currentValue: { observers: unknown[] } }> })
      .kipTimers['race']?.currentValue.observers.length ?? 0;

  it('keeps a single timer subscription when the timer is re-armed', async () => {
    await setup();
    expect(observerCount()).toBe(1);

    // Re-arm several times, as the config effect would on each options() change.
    const comp = component as unknown as { ensureTimer: (n: number) => void };
    comp.ensureTimer(-280);
    comp.ensureTimer(-260);
    comp.ensureTimer(-240);

    // Without lifecycle management this would be 4 (one per subscribe, none removed).
    expect(observerCount()).toBe(1);
  });

  it('tears down the timer subscription when the widget is destroyed', async () => {
    await setup();
    expect(observerCount()).toBe(1);

    fixture.destroy();

    expect(observerCount()).toBe(0);
  });
});
