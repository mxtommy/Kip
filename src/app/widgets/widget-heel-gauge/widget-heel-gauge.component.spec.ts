import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WidgetHeelGaugeComponent } from './widget-heel-gauge.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';

describe('WidgetHeelGaugeComponent', () => {
  let fixture: ComponentFixture<WidgetHeelGaugeComponent>;
  let component: WidgetHeelGaugeComponent;
  let originalGetTotalLength: ((this: SVGElement) => number) | undefined;
  let originalGetPointAtLength: ((this: SVGElement, distance: number) => DOMPoint) | undefined;

  beforeEach(async () => {
    originalGetTotalLength = (SVGElement.prototype as SVGElement & { getTotalLength?: () => number }).getTotalLength;
    originalGetPointAtLength = (SVGElement.prototype as SVGElement & { getPointAtLength?: (distance: number) => DOMPoint }).getPointAtLength;

    (SVGElement.prototype as SVGElement & { getTotalLength: () => number }).getTotalLength = () => 100;
    (SVGElement.prototype as SVGElement & { getPointAtLength: (distance: number) => DOMPoint }).getPointAtLength = (distance: number) => {
      const x = Math.max(0, Math.min(100, distance));
      return { x, y: 20 } as DOMPoint;
    };

    await TestBed.configureTestingModule({
      imports: [WidgetHeelGaugeComponent],
      providers: [
        {
          provide: WidgetRuntimeDirective,
          useValue: {
            options: () => ({
              gauge: { sideLabel: true },
              paths: {
                angle: {
                  sampleTime: 1000,
                },
              },
              numDecimal: 1,
              displayName: 'Heel',
              color: 'contrast',
            }),
          },
        },
        {
          provide: WidgetStreamsDirective,
          useValue: {
            observe: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetHeelGaugeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'heel-1');
    fixture.componentRef.setInput('type', 'widget-heel-gauge');
    fixture.componentRef.setInput('theme', {
      contrast: '#fff',
      zoneNominal: '#0f0',
      zoneWarn: '#ff0',
      zoneAlarm: '#f00',
      zoneAlert: '#f0f',
      zoneEmergency: '#00f',
    });
  });

  afterEach(() => {
    if (originalGetTotalLength) {
      (SVGElement.prototype as SVGElement & { getTotalLength: () => number }).getTotalLength = originalGetTotalLength;
    }
    if (originalGetPointAtLength) {
      (SVGElement.prototype as SVGElement & { getPointAtLength: (distance: number) => DOMPoint }).getPointAtLength = originalGetPointAtLength;
    }
  });

  it('should create and render widget title', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Heel');
  });
});
