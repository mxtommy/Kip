import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsConfigComponent } from './config.component';
import { AuthenticationService, IAuthorizationToken } from '../../../services/authentication.service';
import { StorageService } from '../../../services/storage.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { ProfileService, IProfileSummary } from '../../../services/profile.service';
import { DialogService } from '../../../services/dialog.service';

const createToken = (overrides: Partial<IAuthorizationToken> = {}): IAuthorizationToken => ({
  token: 'token',
  expiry: Date.now() / 1000 + 3600,
  isDeviceAccessToken: false,
  ...overrides
});

describe('SettingsConfigComponent', () => {
  let component: SettingsConfigComponent;
  let fixture: ComponentFixture<SettingsConfigComponent>;
  let authTokenSubject: BehaviorSubject<IAuthorizationToken | null>;
  let profilesSignal: ReturnType<typeof signal<IProfileSummary[]>>;
  let profileMock: {
    profiles: typeof profilesSignal;
    refresh: ReturnType<typeof vi.fn>;
    switchProfile: ReturnType<typeof vi.fn>;
    createProfile: ReturnType<typeof vi.fn>;
    renameProfile: ReturnType<typeof vi.fn>;
    duplicateProfile: ReturnType<typeof vi.fn>;
    deleteProfile: ReturnType<typeof vi.fn>;
    importProfile: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    openConfirmationDialog: ReturnType<typeof vi.fn>;
    openNameDialog: ReturnType<typeof vi.fn>;
  };
  let toastMock: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authTokenSubject = new BehaviorSubject<IAuthorizationToken | null>(null);
    profilesSignal = signal<IProfileSummary[]>([
      { name: 'default', isActive: false },
      { name: 'profileA', isActive: true }
    ]);
    profileMock = {
      profiles: profilesSignal,
      refresh: vi.fn().mockResolvedValue(undefined),
      switchProfile: vi.fn().mockResolvedValue(undefined),
      createProfile: vi.fn().mockResolvedValue(undefined),
      renameProfile: vi.fn().mockResolvedValue(undefined),
      duplicateProfile: vi.fn().mockResolvedValue(undefined),
      deleteProfile: vi.fn().mockResolvedValue(undefined),
      importProfile: vi.fn().mockResolvedValue(undefined)
    };
    dialogMock = {
      openConfirmationDialog: vi.fn().mockReturnValue(of(true)),
      openNameDialog: vi.fn().mockReturnValue({ afterClosed: () => of({ name: 'cockpit' }) })
    };
    toastMock = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SettingsConfigComponent],
      providers: [
        { provide: AuthenticationService, useValue: { authToken$: authTokenSubject.asObservable() } },
        { provide: StorageService, useValue: { isAppDataSupported: true } },
        { provide: ToastService, useValue: toastMock },
        { provide: ProfileService, useValue: profileMock },
        { provide: DialogService, useValue: dialogMock },
        {
          provide: SettingsService,
          useValue: {
            useSharedConfig: true,
            getAppConfig: vi.fn(),
            getDashboardConfig: vi.fn(),
            getThemeConfig: vi.fn(),
            loadConfigFromLocalStorage: vi.fn(),
            reloadApp: vi.fn(),
            resetSettings: vi.fn(),
            resetConnection: vi.fn(),
            loadDemoConfig: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('loads profiles when logged in with a user token', () => {
    authTokenSubject.next(createToken({ isDeviceAccessToken: false }));
    fixture.detectChanges();
    expect(component.hasToken).toBe(true);
    expect(component.isTokenTypeDevice).toBe(false);
    expect(profileMock.refresh).toHaveBeenCalled();
  });

  it('does not load profiles for a device token (profiles are user-scope)', () => {
    profileMock.refresh.mockClear();
    authTokenSubject.next(createToken({ isDeviceAccessToken: true }));
    fixture.detectChanges();
    expect(profileMock.refresh).not.toHaveBeenCalled();
  });

  it('switchProfile confirms then delegates to ProfileService', async () => {
    await component['switchProfile']('cockpit');
    expect(dialogMock.openConfirmationDialog).toHaveBeenCalled();
    expect(profileMock.switchProfile).toHaveBeenCalledWith('cockpit');
  });

  it('switchProfile does nothing when the confirmation is cancelled', async () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(false));
    await component['switchProfile']('cockpit');
    expect(profileMock.switchProfile).not.toHaveBeenCalled();
  });

  it('createProfile passes the chosen name and seed', async () => {
    component['createProfile']('current');
    await Promise.resolve();
    expect(profileMock.createProfile).toHaveBeenCalledWith('cockpit', 'current');
  });

  it('deleteProfile confirms then delegates', async () => {
    await component['deleteProfile']('old');
    expect(profileMock.deleteProfile).toHaveBeenCalledWith('old');
  });

  it('surfaces ProfileService errors via toast', async () => {
    profileMock.switchProfile.mockRejectedValueOnce(new Error('boom'));
    await component['switchProfile']('cockpit');
    expect(toastMock.show).toHaveBeenCalledWith('boom', 0, false, 'error');
  });
});
