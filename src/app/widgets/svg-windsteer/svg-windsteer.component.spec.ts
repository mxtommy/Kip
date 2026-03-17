import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    const rafSpy = spyOn(window, 'requestAnimationFrame').and.callFake(() => 1);

    setRequiredInputs();
    fixture.detectChanges();

    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('animates on subsequent updates after initialization', () => {
    const rafSpy = spyOn(window, 'requestAnimationFrame').and.callFake(() => 1);

    setRequiredInputs();
    fixture.detectChanges();
    rafSpy.calls.reset();

    fixture.componentRef.setInput('appWindAngle', 42);
    fixture.detectChanges();

    expect(rafSpy).toHaveBeenCalled();
  });

  it('treats waypoint angle 0 as valid data', () => {
    setRequiredInputs({ waypointAngle: 0, waypointEnabled: true });
    fixture.detectChanges();

    expect((component as unknown as { waypointActive: () => boolean }).waypointActive()).toBeTrue();
    expect((component as unknown as { wpt: { newValue: number } }).wpt.newValue).toBe(0);
  });
});
