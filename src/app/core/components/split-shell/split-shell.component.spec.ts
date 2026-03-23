import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { SplitShellComponent } from './split-shell.component';
import { SettingsService } from '../../services/settings.service';
import { DashboardService, widgetOperation } from '../../services/dashboard.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BehaviorSubject, of } from 'rxjs';
import { RemoteDashboardsService } from '../../services/remote-dashboards.service';
import { INotificationConfig } from '../../interfaces/app-settings.interfaces';

class MockSettingsService {
    private ratio = 0.3; // stored as ratio (0-1)
    private side: 'left' | 'right' = 'right';
    private notificationConfig: INotificationConfig = {
        disableNotifications: true,
        menuGrouping: false,
        security: { disableSecurity: true },
        devices: { disableDevices: true, showNormalState: false, showNominalState: false },
        sound: { disableSound: true, muteNormal: true, muteNominal: true, muteWarn: true, muteAlert: true, muteAlarm: true, muteEmergency: true }
    };
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
    getNotificationServiceConfigAsO() { return of(this.notificationConfig); }
    getNotificationConfig() { return this.notificationConfig; }
    // Methods consumed by DatasetStreamService (indirectly via nested components)
    // Return true to bypass cleanup requiring additional settings API
    configUpgrade() { return true; }
    // Minimal datasets config
    getDataSets() { return []; }
}

class MockDashboardService {
    private _dashboards = signal([{ id: '1', collapseSplitShell: false }]);
    dashboards(): {
        id: string;
        collapseSplitShell?: boolean;
    }[] { return this._dashboards(); }
    activeDashboard() { return 0; }
    isDashboardStatic() { return true; }
    public widgetAction$ = new BehaviorSubject<widgetOperation>(null).asObservable();
    public layoutEditSaved() { return 0; }
    public layoutEditCanceled() { return 0; }
    setCollapseSplitShell(collapsed: boolean): void {
        this._dashboards.update((dashboards) => dashboards.map((dashboard, index) => {
            if (index !== this.activeDashboard()) {
                return dashboard;
            }

            return {
                ...dashboard,
                collapseSplitShell: collapsed,
            };
        }));
    }
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
        TestBed.overrideComponent(SplitShellComponent, {
            set: {
                template: '<div class="split-root"><div #panel></div></div>',
                imports: []
            }
        });

        await TestBed.configureTestingModule({
            imports: [SplitShellComponent],
            providers: [
                { provide: SettingsService, useClass: MockSettingsService },
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

    it('should reflect collapse state from dashboard configuration', () => {
        const fixture = TestBed.createComponent(SplitShellComponent);
        const comp = fixture.componentInstance;
        const dashboard = TestBed.inject(DashboardService) as unknown as MockDashboardService;
        fixture.detectChanges();

        expect(comp.panelCollapsed()).toBe(false);

        dashboard.setCollapseSplitShell(true);
        expect(comp.panelCollapsed()).toBe(true);

        dashboard.setCollapseSplitShell(false);
        expect(comp.panelCollapsed()).toBe(false);
    });
});
