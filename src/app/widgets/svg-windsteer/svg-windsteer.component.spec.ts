import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SvgWindsteerComponent } from './svg-windsteer.component';

describe('SvgWindsteerComponent', () => {
    let fixture: ComponentFixture<SvgWindsteerComponent>;
    let component: SvgWindsteerComponent;

    const setRequiredInputs = (overrides: Record<string, unknown> = {}): void => {
        const defaults: Record<string, unknown> = {
            compassHeading: 15,
            compassModeEnabled: true,
            courseOverGroundEnabled: true,
            trueWindAngle: 20,
            twsEnabled: true,
            twaEnabled: true,
            trueWindSpeed: 12,
            trueWindSpeedUnit: 'knots',
            appWindAngle: 18,
            awsEnabled: true,
            appWindSpeed: 10,
            appWindSpeedUnit: 'knots',
            closeHauledLineEnabled: false,
            sailSetupEnabled: false,
            windSectorEnabled: false,
            driftEnabled: true,
            waypointEnabled: true,
            driftSet: 7,
            waypointAngle: 30,
            courseOverGroundAngle: 16
        };

        Object.entries({ ...defaults, ...overrides }).forEach(([key, value]) => {
            fixture.componentRef.setInput(key, value);
        });
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SvgWindsteerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SvgWindsteerComponent);
        component = fixture.componentInstance;
    });

    it('renders first values without rotation animation', () => {
        // Set up component with initial values
        setRequiredInputs();
        fixture.detectChanges();

        // Verify that the dial and COG are set to their correct initial values (not animating)
        const dialElement = component['rotatingDial']()?.nativeElement;
        const cogElement = component['cogIndicator']()?.nativeElement;

        // On first render, the transform should be set immediately (not animated)
        // Dial should be at -15 degrees (compass heading 15), COG should be at 1 degree (16 - 15)
        expect(dialElement?.getAttribute('transform')).toMatch(/rotate\(-15 /);
        expect(cogElement?.getAttribute('transform')).toMatch(/rotate\(1 /);
    });

    it('animates on subsequent updates after initialization', () => {
        const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

        setRequiredInputs();
        fixture.detectChanges();
        rafSpy.mockClear();

        fixture.componentRef.setInput('appWindAngle', 42);
        fixture.detectChanges();

        expect(rafSpy).toHaveBeenCalled();
    });

    it('treats waypoint angle 0 as valid data', () => {
        setRequiredInputs({ waypointAngle: 0, waypointEnabled: true });
        fixture.detectChanges();

        expect((component as unknown as {
            waypointActive: () => boolean;
        }).waypointActive()).toBe(true);
        expect((component as unknown as {
            wpt: {
                newValue: number;
            };
        }).wpt.newValue).toBe(0);
    });
});
