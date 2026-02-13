import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, waitForAsync } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';
import { signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ToastService } from '../../../services/toast.service';
import { AppService } from '../../../services/app-service';
import { AppSettingsService } from '../../../services/app-settings.service';
import { SignalkPluginConfigService } from '../../../services/signalk-plugin-config.service';

import { SettingsDisplayComponent } from './display.component';
import { MatSlideToggle } from '@angular/material/slide-toggle';

class BreakpointObserverMock {
  public observe() {
    return of({ matches: false, breakpoints: {} });
  }
}

class AppServiceMock {
  public isNightMode = signal(false);

  public setBrightness(): void {}
}

class ToastServiceMock {
  public show = jasmine.createSpy('show').and.returnValue({
    onAction: () => EMPTY,
    afterDismissed: () => of({ dismissedByAction: false })
  });
}

class AppSettingsServiceMock {
  public getNightModeBrightness() { return 0.27; }
  public getAutoNightMode() { return false; }
  public getThemeName() { return ''; }
  public getRedNightMode() { return false; }
  public getIsRemoteControl() { return false; }
  public getInstanceName() { return ''; }
  public getSplitShellEnabled() { return false; }
  public getSplitShellSide() { return 'left' as const; }
  public getSplitShellSwipeDisabled() { return false; }
  public setAutoNightMode(): void {}
  public setRedNightMode(): void {}
  public setNightModeBrightness(): void {}
  public setIsRemoteControl(): void {}
  public setInstanceName(): void {}
  public setThemeName(): void {}
  public setSplitShellEnabled(): void {}
  public setSplitShellSide(): void {}
  public setSplitShellSwipeDisabled(): void {}
}

class SignalkPluginConfigServiceMock {
  public getPlugin = jasmine.createSpy('getPlugin').and.resolveTo({
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
  public savePluginConfig = jasmine.createSpy('savePluginConfig').and.resolveTo({ ok: true });
}

describe('SettingsNotificationsComponent', () => {
  let component: SettingsDisplayComponent;
  let fixture: ComponentFixture<SettingsDisplayComponent>;
  let toast: ToastServiceMock;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [SettingsDisplayComponent],
      providers: [
        { provide: BreakpointObserver, useClass: BreakpointObserverMock },
        { provide: AppService, useClass: AppServiceMock },
        { provide: ToastService, useClass: ToastServiceMock },
        { provide: AppSettingsService, useClass: AppSettingsServiceMock },
        { provide: SignalkPluginConfigService, useClass: SignalkPluginConfigServiceMock }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsDisplayComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as ToastServiceMock;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows single warning prompt with Ok action when plugin is installed but not enabled/configured', fakeAsync(() => {
    // Toggle auto night mode on
    component['isAutoNightModeSupported']({ checked: true, source: {} as MatSlideToggle });
    expect(component['autoNightMode']()).toBe(true);

    // Trigger save which validates
    component['saveAllSettings']();
    flushMicrotasks();

    expect(toast.show).toHaveBeenCalledWith(
      "To enable Automatic Night Mode, the Derived Data plugin must be enabled and the environment.sun path must be set to true. Do you wish to enable & configure?",
      0,
      false,
      'warn',
      'Ok'
    );
  }));

  it('shows prompt for enabling plugin only when plugin is disabled but sun flag is true', fakeAsync(() => {
    const pluginService = TestBed.inject(SignalkPluginConfigService) as unknown as SignalkPluginConfigServiceMock;
    pluginService.getPlugin.and.resolveTo({
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
    flushMicrotasks();

    expect(toast.show).toHaveBeenCalledWith(
      "To enable Automatic Night Mode, the Derived Data plugin must be enabled. Do you wish to enable it?",
      0,
      false,
      'warn',
      'Ok'
    );
  }));

  it('shows prompt for configuring sun flag only when plugin is enabled but sun flag is false', fakeAsync(() => {
    const pluginService = TestBed.inject(SignalkPluginConfigService) as unknown as SignalkPluginConfigServiceMock;
    pluginService.getPlugin.and.resolveTo({
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
    flushMicrotasks();

    expect(toast.show).toHaveBeenCalledWith(
      "To enable Automatic Night Mode, the environment.sun path in the Derived Data plugin must be set to true. Do you wish to configure it?",
      0,
      false,
      'warn',
      'Ok'
    );
  }));
});
