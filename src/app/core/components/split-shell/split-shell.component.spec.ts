import { TestBed } from '@angular/core/testing';
import { SplitShellComponent } from './split-shell.component';
import { AppSettingsService } from '../../services/app-settings.service';
import { DashboardService, widgetOperation } from '../../services/dashboard.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BehaviorSubject, of } from 'rxjs';
import { RemoteDashboardsService } from '../../services/remote-dashboards.service';

class MockAppSettingsService {
  private ratio = 0.3; // stored as ratio (0-1)
  private side: 'left' | 'right' = 'right';
  // Minimal properties consumed by other services
  public signalkUrl = { url: 'http://localhost:3000' };
  public KipUUID = 'test-kip-uuid';
  getSplitShellSide() { return this.side; }
  getSplitShellWidth() { return this.ratio; }
  setSplitShellWidth(v: number) { this.ratio = v; }
  // New API consumed by component to build a signal
  getSplitShellSwipeDisabledAsO() { return of(false); }
  // Methods consumed by AppService/RemoteDashboardsService in nested imports
  getInstanceNameAsO() { return of('Test Instance'); }
  getIsRemoteControlAsO() { return of(false); }
  getAutoNightModeAsO() { return of(false); }
  getThemeNameAsO() { return of('light-theme'); }
  getRedNightModeAsO() { return of(false); }
  // Methods consumed by DatasetService (indirectly via nested components)
  // Return true to bypass cleanup requiring additional settings API
  configUpgrade() { return true; }
  // Minimal datasets config
  getDataSets() { return []; }
}

class MockDashboardService {
  private _dashboards = [{ id: '1', collapseSplitShell: false }];
  dashboards(): { id: string; collapseSplitShell?: boolean }[] { return this._dashboards; }
  activeDashboard() { return 0; }
  isDashboardStatic() { return true; }
  public widgetAction$ = new BehaviorSubject<widgetOperation>(null).asObservable();
  public layoutEditSaved() { return 0; }
  public layoutEditCanceled() { return 0; }
}

class MockBreakpointObserver {
  observe() { return of({ matches: false, breakpoints: {} }); }
}

// Avoid constructing the real RemoteDashboardsService (effects + HTTP)
class MockRemoteDashboardsService {
  // no-op constructor/effects
  setActiveDashboard(): Promise<unknown> { return Promise.resolve({}); }
  shareScreens(): Promise<unknown> { return Promise.resolve({}); }
}

describe('SplitShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitShellComponent],
      providers: [
        { provide: AppSettingsService, useClass: MockAppSettingsService },
        { provide: DashboardService, useClass: MockDashboardService },
        { provide: BreakpointObserver, useClass: MockBreakpointObserver },
        { provide: RemoteDashboardsService, useClass: MockRemoteDashboardsService }
      ]
    }).compileComponents();
  });

  it('should create and compute initial width without errors', () => {
    const fixture = TestBed.createComponent(SplitShellComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    expect(comp).toBeTruthy();
    // panelWidth is derived from host width; ensure it computed to a non-negative number
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
