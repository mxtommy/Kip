import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, of } from 'rxjs';
import { signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ToastService } from '../../../services/toast.service';
import { AppService } from '../../../services/app-service';
import { SettingsService } from '../../../services/settings.service';
import { PluginConfigClientService } from '../../../services/plugin-config-client.service';

import { SettingsDisplayComponent } from './display.component';
import { MatSlideToggle } from '@angular/material/slide-toggle';

class BreakpointObserverMock {
    public observe() {
        return of({ matches: false, breakpoints: {} });
    }
}

class AppServiceMock {
    public isNightMode = signal(false);

    public setBrightness(): void { }
}

class ToastServiceMock {
    public show = vi.fn().mockReturnValue({
        onAction: () => EMPTY,
        afterDismissed: () => of({ dismissedByAction: false })
    });
}

class SettingsServiceMock {
    public getNightModeBrightness() { return 0.27; }
    public getAutoNightMode() { return false; }
    public getThemeName() { return ''; }
    public getRedNightMode() { return false; }
    public getIsRemoteControl() { return false; }
    public getInstanceName() { return ''; }
    public getSplitShellEnabled() { return false; }
    public getSplitShellSide() { return 'left' as const; }
    public getSplitShellSwipeDisabled() { return false; }
    public getWidgetHistoryDisabled() { return false; }
    public setAutoNightMode(): void { }
    public setRedNightMode(): void { }
    public setNightModeBrightness(): void { }
    public setIsRemoteControl(): void { }
    public setInstanceName(): void { }
    public setThemeName(): void { }
    public setSplitShellEnabled(): void { }
    public setSplitShellSide(): void { }
    public setSplitShellSwipeDisabled(): void { }
    public setWidgetHistoryDisabled(): void { }
}

class PluginConfigClientServiceMock {
    public getPlugin = vi.fn().mockResolvedValue({
        ok: true,
        data: {
            id: 'derived-data',
            state: {
                enabled: false,
                configuration: { sun: false },
                enableLogging: false,
                enableDebug: false
            }
        }
    });
    public savePluginConfig = vi.fn().mockResolvedValue({ ok: true });
}

describe('SettingsNotificationsComponent', () => {
    let component: SettingsDisplayComponent;
    let fixture: ComponentFixture<SettingsDisplayComponent>;
    let toast: ToastServiceMock;

    const flushPromises = async (): Promise<void> => {
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SettingsDisplayComponent],
            providers: [
                { provide: BreakpointObserver, useClass: BreakpointObserverMock },
                { provide: AppService, useClass: AppServiceMock },
                { provide: ToastService, useClass: ToastServiceMock },
                { provide: SettingsService, useClass: SettingsServiceMock },
                { provide: PluginConfigClientService, useClass: PluginConfigClientServiceMock }
            ]
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SettingsDisplayComponent);
        component = fixture.componentInstance;
        toast = TestBed.inject(ToastService) as unknown as ToastServiceMock;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('shows single warning prompt with Ok action when plugin is installed but not enabled/configured', async () => {
        // Toggle auto night mode on
        component['isAutoNightModeSupported']({ checked: true, source: {} as MatSlideToggle });
        expect(component['autoNightMode']()).toBe(true);

        // Trigger save which validates
        component['saveAllSettings']();
        await flushPromises();

        expect(toast.show).toHaveBeenCalledWith("To enable Automatic Night Mode, the Derived Data plugin must be enabled and the environment.sun path must be set to true. Do you wish to enable & and activate the path?", 0, false, 'warn', 'Ok');
    });

    it('shows prompt for enabling plugin only when plugin is disabled but sun flag is true', async () => {
        const pluginService = TestBed.inject(PluginConfigClientService) as unknown as PluginConfigClientServiceMock;
        pluginService.getPlugin.mockResolvedValue({
            ok: true,
            data: {
                id: 'derived-data',
                state: {
                    enabled: false,
                    configuration: { sun: true },
                    enableLogging: false,
                    enableDebug: false
                }
            }
        });

        // Toggle auto night mode on
        component['isAutoNightModeSupported']({ checked: true, source: {} as MatSlideToggle });
        expect(component['autoNightMode']()).toBe(true);

        // Trigger save which validates
        component['saveAllSettings']();
        await flushPromises();

        expect(toast.show).toHaveBeenCalledWith("To enable Automatic Night Mode, the Derived Data plugin must be enabled. Do you wish to enable the plugin?", 0, false, 'warn', 'Ok');
    });

    it('shows prompt for configuring sun flag only when plugin is enabled but sun flag is false', async () => {
        const pluginService = TestBed.inject(PluginConfigClientService) as unknown as PluginConfigClientServiceMock;
        pluginService.getPlugin.mockResolvedValue({
            ok: true,
            data: {
                id: 'derived-data',
                state: {
                    enabled: true,
                    configuration: { sun: false },
                    enableLogging: false,
                    enableDebug: false
                }
            }
        });

        // Toggle auto night mode on
        component['isAutoNightModeSupported']({ checked: true, source: {} as MatSlideToggle });
        expect(component['autoNightMode']()).toBe(true);

        // Trigger save which validates
        component['saveAllSettings']();
        await flushPromises();

        expect(toast.show).toHaveBeenCalledWith("To enable Automatic Night Mode, the environment.sun path in the Derived Data plugin must be activated. Do you wish to activate the path?", 0, false, 'warn', 'Ok');
    });
});
