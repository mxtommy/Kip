import { TestBed } from '@angular/core/testing';
import { SplitShellComponent } from './split-shell.component';
import { AppSettingsService } from '../../services/app-settings.service';
import { DashboardService } from '../../services/dashboard.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';

class MockAppSettingsService {
  private width = 380;
  private collapsed = false;
  private side: 'left' | 'right' = 'right';
  getFreeboardShellSide() { return this.side; }
  getFreeboardShellWidth() { return this.width; }
  getFreeboardShellCollapsed() { return this.collapsed; }
  setFreeboardShellWidth(v: number) { this.width = v; }
  setFreeboardShellCollapsed(v: boolean) { this.collapsed = v; }
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

  it('should create and reflect initial width', () => {
    const fixture = TestBed.createComponent(SplitShellComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp).toBeTruthy();
    expect(comp.panelWidth()).toBe(380);
  });

  it('should toggle collapse (when not forced)', () => {
    const fixture = TestBed.createComponent(SplitShellComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const prev = comp.panelCollapsed();
    comp.toggleCollapse();
    expect(comp.panelCollapsed()).toBe(!prev);
  });
});
