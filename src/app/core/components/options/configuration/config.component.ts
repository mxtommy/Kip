import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { AuthenticationService } from '../../../services/authentication.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { IConfig } from '../../../interfaces/app-settings.interfaces';
import { StorageService } from '../../../services/storage.service';
import { ProfileService } from '../../../services/profile.service';
import { DialogService } from '../../../services/dialog.service';
import { MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'settings-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    imports: [RouterLink, FormsModule, MatDivider, MatButton, MatIconModule]
})
export class SettingsConfigComponent {
  private settings = inject(SettingsService);
  private storageSvc = inject(StorageService);
  private toast = inject(ToastService);
  private auth = inject(AuthenticationService);
  private profileService = inject(ProfileService);
  private dialog = inject(DialogService);

  private isUserSession = toSignal(this.auth.isUserSession$, { initialValue: false });

  protected readonly pageTitle = 'Profiles';
  public supportApplicationData = this.storageSvc.isAppDataSupported;

  // Profiles are user-scope: available with a real Signal K user session — a cookie-mode SSO session
  // or a non-device token. Keying off isUserSession$ (not raw token presence) is what makes profiles
  // appear in cookie mode, where the httpOnly session cookie carries auth and there is no JWT. A device
  // token resolves to the shared 'global' scope, and an anonymous visitor has no user scope.
  protected profilesAvailable = computed(() =>
    this.supportApplicationData && this.isUserSession()
  );
  // Read is available to any user session; profile mutations (create/rename/duplicate/delete/import)
  // need write capability — a read-only session must not get live write controls.
  protected canWriteUserData = toSignal(this.auth.canWriteUserData$, { initialValue: false });
  protected profiles = this.profileService.profiles;

  private readonly profileLoadEffect = effect(() => {
    if (this.profilesAvailable()) {
      this.profileService.refresh().catch((err) => this.reportError(err));
    }
  });

  protected async switchProfile(name: string): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.openConfirmationDialog({
        title: 'Switch profile',
        message: `Switch this device to "${name}"? KIP will reload to load the profile.`,
        confirmBtnText: 'Switch',
        cancelBtnText: 'Cancel'
      })
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.profileService.switchProfile(name);
    } catch (err) {
      this.reportError(err);
    }
  }

  protected createProfile(): void {
    this.dialog
      .openNameDialog({
        title: 'New profile',
        name: '',
        confirmBtnText: 'Create',
        cancelBtnText: 'Cancel'
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (!result?.name) {
          return;
        }
        try {
          await this.profileService.createProfile(result.name);
        } catch (err) {
          this.reportError(err);
        }
      });
  }

  protected renameProfile(name: string): void {
    this.dialog
      .openNameDialog({ title: 'Rename profile', name, confirmBtnText: 'Rename', cancelBtnText: 'Cancel' })
      .afterClosed()
      .subscribe(async (result) => {
        if (!result?.name || result.name === name) {
          return;
        }
        try {
          await this.profileService.renameProfile(name, result.name);
        } catch (err) {
          this.reportError(err);
        }
      });
  }

  protected duplicateProfile(name: string): void {
    this.dialog
      .openNameDialog({ title: 'Duplicate profile', name: `${name} copy`, confirmBtnText: 'Duplicate', cancelBtnText: 'Cancel' })
      .afterClosed()
      .subscribe(async (result) => {
        if (!result?.name) {
          return;
        }
        try {
          await this.profileService.duplicateProfile(name, result.name);
        } catch (err) {
          this.reportError(err);
        }
      });
  }

  protected async deleteProfile(name: string): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.openConfirmationDialog({
        title: 'Delete profile',
        message: `Permanently delete profile "${name}"? This cannot be undone.`,
        confirmBtnText: 'Delete',
        cancelBtnText: 'Cancel'
      })
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.profileService.deleteProfile(name);
    } catch (err) {
      this.reportError(err);
    }
  }

  public getActiveConfig(): IConfig {
    return this.settings.useSharedConfig ? this.getLocalConfigFromMemory() : this.getLocalConfigFromLocalStorage();
  }

  public getLocalConfigFromMemory(): IConfig {
    return {
      app: this.settings.getAppConfig(),
      dashboards: this.settings.getDashboardConfig(),
      theme: this.settings.getThemeConfig()
    };
  }

  public getLocalConfigFromLocalStorage(): IConfig {
    return {
      app: this.settings.loadConfigFromLocalStorage('appConfig'),
      dashboards: this.settings.loadConfigFromLocalStorage('dashboardsConfig'),
      theme: this.settings.loadConfigFromLocalStorage('themeConfig')
    };
  }

  public downloadJsonConfig(): void {
    const jsonString = JSON.stringify(this.getActiveConfig(), null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const downloadURL = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadURL;
    a.download = 'KipConfig.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadURL);
  }

  /** Import a config file as a NEW profile (never overwrites the active one). */
  public uploadJsonConfig(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || file.type !== 'application/json') {
      this.toast.show('Please select a valid JSON file', 0, false, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(e.target?.result as string);
      } catch (err) {
        this.toast.show('File does not contain valid JSON.', 0, false, 'error');
        console.error('Invalid JSON file format:', err);
        return;
      }
      this.dialog
        .openNameDialog({ title: 'Import as new profile', name: '', confirmBtnText: 'Import', cancelBtnText: 'Cancel' })
        .afterClosed()
        .subscribe(async (result) => {
          if (!result?.name) {
            return;
          }
          try {
            await this.profileService.importProfile(result.name, parsed);
            this.toast.show(`Profile "${result.name}" imported`, 1000, true, 'success');
          } catch (err) {
            this.reportError(err);
          }
        });
    };
    reader.readAsText(file);
    input.value = '';
  }

  public loadDemoConfig(): void {
    this.settings.loadDemoConfig();
  }

  public resetConfigToDefault(): void {
    this.settings.resetSettings();
  }

  public resetConnectionToDefault(): void {
    this.settings.resetConnection();
  }

  private reportError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.toast.show(message, 0, false, 'error');
  }
}
