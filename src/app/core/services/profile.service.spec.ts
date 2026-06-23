import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileService } from './profile.service';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { IConfig } from '../interfaces/app-settings.interfaces';

const cfg = (theme = 'x'): IConfig => ({
  app: { configVersion: 12 } as IConfig['app'],
  theme: { themeName: theme },
  dashboards: [{ id: 'd' }]
});

function makeStorageMock(userNames: string[] = ['default', 'profileA']) {
  return {
    sharedConfigName: 'profileA',
    listConfigs: vi.fn<() => Promise<{ scope: string; name: string }[]>>(() =>
      Promise.resolve([
        ...userNames.map((name) => ({ scope: 'user', name })),
        { scope: 'global', name: 'sharedThing' }
      ])
    ),
    getConfig: vi.fn<(scope: string, name: string) => Promise<IConfig>>(() => Promise.resolve(cfg('fromGet'))),
    setConfig: vi.fn<(scope: string, name: string, config: IConfig) => Promise<null>>(() => Promise.resolve(null)),
    removeItem: vi.fn<(scope: string, name: string) => void>(() => undefined),
    awaitQueueDrain: vi.fn<() => Promise<boolean>>(() => Promise.resolve(true))
  };
}

function makeSettingsMock(active = 'profileA') {
  return {
    getActiveProfileName: vi.fn(() => active),
    setActiveProfile: vi.fn(),
    getActiveConfigSnapshot: vi.fn(() => cfg('current'))
  };
}

describe('ProfileService', () => {
  let service: ProfileService;
  let storage: ReturnType<typeof makeStorageMock>;
  let settings: ReturnType<typeof makeSettingsMock>;

  function setup(storageMock = makeStorageMock(), settingsMock = makeSettingsMock()) {
    storage = storageMock;
    settings = settingsMock;
    TestBed.resetTestingModule(); // allow tests to reconfigure with different mocks
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: StorageService, useValue: storage },
        { provide: SettingsService, useValue: settings }
      ]
    });
    service = TestBed.inject(ProfileService);
  }

  beforeEach(() => setup());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('refresh / list', () => {
    it('lists user-scope profiles (incl default), flags the active one, drops global scope', async () => {
      await service.refresh();
      expect(service.profiles().map((p) => p.name)).toEqual(['default', 'profileA']);
      expect(service.profiles().find((p) => p.name === 'profileA')?.isActive).toBe(true);
      expect(service.profiles().find((p) => p.name === 'default')?.isActive).toBe(false);
    });
  });

  describe('switch', () => {
    it('drains the queue then delegates to SettingsService.setActiveProfile', async () => {
      await service.switchProfile('cockpit');
      expect(storage.awaitQueueDrain).toHaveBeenCalled();
      expect(settings.setActiveProfile).toHaveBeenCalledWith('cockpit');
    });
  });

  describe('create', () => {
    it('blank seed writes a default config under the new name', async () => {
      await service.refresh();
      await service.createProfile('cockpit', 'blank');
      expect(storage.setConfig).toHaveBeenCalledTimes(1);
      const [scope, name, config] = storage.setConfig.mock.calls[0];
      expect(scope).toBe('user');
      expect(name).toBe('cockpit');
      expect(config.app).toBeTruthy();
      expect(Array.isArray(config.dashboards)).toBe(true);
      expect(config.dashboards.length).toBeGreaterThan(0);
    });

    it('current seed clones the live snapshot', async () => {
      await service.refresh();
      await service.createProfile('cockpit', 'current');
      const config = storage.setConfig.mock.calls[0][2] as IConfig;
      expect(config.theme?.themeName).toBe('current');
    });

    it('does not auto-switch into the created profile', async () => {
      await service.refresh();
      await service.createProfile('cockpit', 'blank');
      expect(settings.setActiveProfile).not.toHaveBeenCalled();
    });

    it.each(['', '   ', 'default', 'profileA', 'bad/name', 'bad.name', 'a~b', 'a::b'])(
      'rejects invalid/duplicate/reserved name "%s" without writing',
      async (bad) => {
        await service.refresh();
        await expect(service.createProfile(bad, 'blank')).rejects.toThrow();
        expect(storage.setConfig).not.toHaveBeenCalled();
      }
    );

    it('surfaces a storage failure and never switches', async () => {
      await service.refresh();
      storage.setConfig.mockRejectedValueOnce(new Error('500'));
      await expect(service.createProfile('cockpit', 'blank')).rejects.toThrow();
      expect(settings.setActiveProfile).not.toHaveBeenCalled();
    });
  });

  describe('duplicate', () => {
    it('copies the source config under a new name', async () => {
      await service.refresh();
      await service.duplicateProfile('profileA', 'profileB');
      expect(storage.getConfig).toHaveBeenCalledWith('user', 'profileA');
      expect(storage.setConfig).toHaveBeenCalledWith('user', 'profileB', expect.anything());
    });
  });

  describe('delete (guard rails)', () => {
    it('blocks deleting the active profile', async () => {
      await service.refresh();
      await expect(service.deleteProfile('profileA')).rejects.toThrow(/active/i);
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('blocks deleting the reserved default profile', async () => {
      await service.refresh();
      await expect(service.deleteProfile('default')).rejects.toThrow(/default/i);
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('blocks deleting the last remaining profile', async () => {
      setup(makeStorageMock(['solo']), makeSettingsMock('other'));
      await service.refresh();
      await expect(service.deleteProfile('solo')).rejects.toThrow(/last/i);
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('deletes a non-active, non-default profile', async () => {
      setup(makeStorageMock(['default', 'profileA', 'old']), makeSettingsMock('profileA'));
      await service.refresh();
      await service.deleteProfile('old');
      expect(storage.removeItem).toHaveBeenCalledWith('user', 'old');
    });
  });

  describe('rename', () => {
    it('renaming the active profile creates new, deletes old, then switches (reload)', async () => {
      await service.refresh(); // active = profileA
      await service.renameProfile('profileA', 'newName');
      expect(storage.setConfig).toHaveBeenCalledWith('user', 'newName', expect.anything());
      expect(storage.removeItem).toHaveBeenCalledWith('user', 'profileA');
      expect(settings.setActiveProfile).toHaveBeenCalledWith('newName');
      // ordering: create new slot before deleting old before switching
      const setOrder = storage.setConfig.mock.invocationCallOrder[0];
      const rmOrder = storage.removeItem.mock.invocationCallOrder[0];
      const switchOrder = settings.setActiveProfile.mock.invocationCallOrder[0];
      expect(setOrder).toBeLessThan(rmOrder);
      expect(rmOrder).toBeLessThan(switchOrder);
    });

    it('renaming a non-active profile does not reload', async () => {
      setup(makeStorageMock(['default', 'profileA', 'other']), makeSettingsMock('profileA'));
      await service.refresh();
      await service.renameProfile('other', 'renamed');
      expect(storage.setConfig).toHaveBeenCalledWith('user', 'renamed', expect.anything());
      expect(storage.removeItem).toHaveBeenCalledWith('user', 'other');
      expect(settings.setActiveProfile).not.toHaveBeenCalled();
    });

    it('blocks renaming the reserved default profile', async () => {
      await service.refresh();
      await expect(service.renameProfile('default', 'x')).rejects.toThrow(/default/i);
    });
  });
});
