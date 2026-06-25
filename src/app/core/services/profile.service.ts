import { Injectable, computed, inject, signal } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { IConfig } from '../interfaces/app-settings.interfaces';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { defaultConfig } from '../../../default-config/config.blank.const';
import { DefaultDashboard } from '../../../default-config/config.blank.dashboard';
import { UUID } from '../utils/uuid.util';

export interface IProfileSummary {
  name: string;
  isActive: boolean;
}

/** Reserved fallback profile name: a fresh device boots into it and it must always be available. */
const RESERVED_DEFAULT = 'default';
/** Profile names are URL path segments AND JSON-Patch keys; '.' truncates and '/' splits on the
 * Signal K server (confirmed by the Unit 1 probe), so only an allow-list charset is safe. */
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;
const MAX_NAME_LENGTH = 64;
const PROFILE_SCOPE = 'user';

/**
 * Owns profile (named config slot) lifecycle: list / switch / create / rename / duplicate / delete.
 * Orchestrates StorageService (slot CRUD, all hardcoded to the 'user' scope) and SettingsService
 * (active-profile name + reload). Mutations reject on storage failure; callers
 * surface the error. The active name is never changed on a failed mutation.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(StorageService);
  private readonly settings = inject(SettingsService);

  private readonly _profiles = signal<IProfileSummary[]>([]);
  public readonly profiles = this._profiles.asReadonly();
  public readonly activeProfileName = computed(() => this._profiles().find((p) => p.isActive)?.name ?? null);

  // Serializes mutating operations: a second create/rename/delete/switch while one is in flight is
  // rejected rather than racing (the plan's double-switch / re-entrancy guard).
  private mutationInFlight = false;

  /** Refresh the user-scope profile list and flag the active one. */
  public async refresh(): Promise<void> {
    const all = (await this.storage.listConfigs()) ?? [];
    const active = this.settings.getActiveProfileName();
    this._profiles.set(
      all
        .filter((c) => c.scope === PROFILE_SCOPE)
        .map((c) => ({ name: c.name, isActive: c.name === active }))
    );
  }

  /** Make a profile active on this device. Verifies the slot still exists, drains pending writes, then persists + reloads. */
  public async switchProfile(name: string): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      if (!this.existingNames().includes(name)) {
        throw new Error(`Profile "${name}" no longer exists — it may have been deleted on another device.`);
      }
      await this.storage.awaitQueueDrain();
      this.settings.setActiveProfile(name);
    });
  }

  /** Create a new profile from a blank default config. Does not switch. */
  public async createProfile(name: string): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      const normalized = this.validateNewName(name);
      await this.storage.setConfig(PROFILE_SCOPE, normalized, cloneDeep(this.buildBlankConfig()));
      await this.refresh();
    });
  }

  /**
   * Import an arbitrary config as a NEW profile (never overwrites an existing one, never
   * auto-switches). The config is structurally validated AND its version checked before it is written,
   * so a shape-valid but unsupported-version file cannot become a switchable, unbootable slot.
   */
  public async importProfile(name: string, config: unknown): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      const normalized = this.validateNewName(name);
      if (!this.isValidConfigShape(config)) {
        throw new Error('The selected file is not a valid KIP configuration.');
      }
      const supported = defaultConfig.app?.configVersion;
      const version = config.app?.configVersion;
      if (version !== supported) {
        throw new Error(`This configuration is version ${version ?? 'unknown'}, but this version of KIP supports version ${supported}. Re-export it from a current KIP and try again.`);
      }
      await this.storage.setConfig(PROFILE_SCOPE, normalized, config);
      await this.refresh();
    });
  }

  /** Copy an existing profile's config under a new name. */
  public async duplicateProfile(sourceName: string, newName: string): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      const normalized = this.validateNewName(newName);
      const sourceConfig = await this.storage.getConfig(PROFILE_SCOPE, sourceName);
      if (!this.isValidConfigShape(sourceConfig)) {
        throw new Error(`Profile "${sourceName}" has no usable configuration to copy.`);
      }
      await this.storage.setConfig(PROFILE_SCOPE, normalized, sourceConfig);
      await this.refresh();
    });
  }

  /**
   * Rename a profile: create the new slot, then delete the old one. When the active profile is
   * renamed, the old slot is deleted (awaited via the queue drain) before switching to the new
   * name so the device never reloads into a missing slot and no orphan is left behind.
   */
  public async renameProfile(oldName: string, newName: string): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      const normalized = this.validateNewName(newName);
      if (oldName === RESERVED_DEFAULT) {
        throw new Error(`The "${RESERVED_DEFAULT}" profile cannot be renamed.`);
      }
      const sourceConfig = await this.storage.getConfig(PROFILE_SCOPE, oldName);
      if (!this.isValidConfigShape(sourceConfig)) {
        throw new Error(`Profile "${oldName}" has no usable configuration to rename.`);
      }
      await this.storage.setConfig(PROFILE_SCOPE, normalized, sourceConfig);

      this.storage.removeItem(PROFILE_SCOPE, oldName);
      await this.storage.awaitQueueDrain();

      if (oldName === this.settings.getActiveProfileName()) {
        this.settings.setActiveProfile(normalized); // persist + reload onto the renamed slot
      } else {
        await this.refresh();
      }
    });
  }

  /** Delete a profile. Refuses the active, the reserved default, and the last remaining profile. */
  public async deleteProfile(name: string): Promise<void> {
    return this.exclusive(async () => {
      await this.refresh();
      if (name === RESERVED_DEFAULT) {
        throw new Error(`The "${RESERVED_DEFAULT}" profile cannot be deleted.`);
      }
      if (name === this.settings.getActiveProfileName()) {
        throw new Error('The active profile cannot be deleted. Switch to another profile first.');
      }
      if (this.existingNames().length <= 1) {
        throw new Error('The last remaining profile cannot be deleted.');
      }
      this.storage.removeItem(PROFILE_SCOPE, name);
      await this.storage.awaitQueueDrain();
      await this.refresh();
    });
  }

  private async exclusive<T>(op: () => Promise<T>): Promise<T> {
    if (this.mutationInFlight) {
      throw new Error('Another profile operation is still in progress. Please wait for it to finish.');
    }
    this.mutationInFlight = true;
    try {
      return await op();
    } finally {
      this.mutationInFlight = false;
    }
  }

  private existingNames(): string[] {
    return this._profiles().map((p) => p.name);
  }

  private isValidConfigShape(c: unknown): c is IConfig {
    if (!c || typeof c !== 'object') {
      return false;
    }
    const cfg = c as Record<string, unknown>;
    return 'app' in cfg && 'theme' in cfg && Array.isArray(cfg['dashboards']);
  }

  private buildBlankConfig(): IConfig {
    const config = cloneDeep(defaultConfig);
    const dashboards = cloneDeep(DefaultDashboard);
    dashboards[0].id = UUID.create();
    config.dashboards = dashboards;
    return config;
  }

  private validateNewName(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new Error('Profile name cannot be empty.');
    }
    if (trimmed === RESERVED_DEFAULT) {
      throw new Error(`"${RESERVED_DEFAULT}" is reserved and cannot be used as a profile name.`);
    }
    if (!PROFILE_NAME_PATTERN.test(trimmed)) {
      throw new Error('Profile name may only contain letters, numbers, spaces, hyphens and underscores.');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new Error('Profile name is too long.');
    }
    if (this.existingNames().includes(trimmed)) {
      throw new Error(`A profile named "${trimmed}" already exists.`);
    }
    return trimmed;
  }
}
