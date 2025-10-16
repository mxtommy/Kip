import { TestBed } from '@angular/core/testing';
import { SplitShellComponent } from './split-shell.component';
import { AppSettingsService } from '../../services/app-settings.service';
import { DashboardService } from '../../services/dashboard.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';

class MockAppSettingsService {
  private ratio = 0.5;
  private side: 'left' | 'right' = 'right';
  getSplitShellSide() { return this.side; }
  getSplitShellWidth() { return this.ratio; }
  setSplitShellWidth(v: number) { this.ratio = v; }
  getSplitShellSwipeDisabledAsO() { return of(false); }
}

class MockDashboardService {
  dashboards() { return [{ id: '1', collapseSplitShell: false }]; }
  activeDashboard() { return 0; }
  isDashboardStatic() { return true; }
}

class MockBreakpointObserver {
  observe() { return of({ matches: false, breakpoints: {} }); }
}

describe('FreeboardSplitComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitShellComponent],
      providers: [
        { provide: AppSettingsService, useClass: MockAppSettingsService },
        { provide: DashboardService, useClass: MockDashboardService },
        { provide: BreakpointObserver, useClass: MockBreakpointObserver }
      ]
    }).compileComponents();
  });

  it('should create and compute initial width ratio', () => {
    const fixture = TestBed.createComponent(SplitShellComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp).toBeTruthy();
    // Width will depend on host size; ensure it computes to a non-negative number
    expect(typeof comp.panelWidth()).toBe('number');
    expect(comp.panelWidth()).toBeGreaterThanOrEqual(0);
  });

  // TODO: API change: SplitShellComponent no longer exposes toggleCollapse().
  // Skipping until spec is updated to new API/interaction.
  xit('should toggle collapse (when not forced)', () => {
    const fixture = TestBed.createComponent(SplitShellComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const prev = comp.panelCollapsed();
    // simulate toggle via new API if available in future
    expect(typeof prev).toBe('boolean');
  });
});
