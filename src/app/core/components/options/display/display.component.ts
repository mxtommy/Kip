import { Component, inject, OnInit, viewChild, signal, Signal, model } from '@angular/core';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { AppService } from '../../../services/app-service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { toSignal } from '@angular/core/rxjs-interop';
import { SignalkPluginConfigService } from '../../../services/signalk-plugin-config.service';
import { IPluginApiFailure, ISignalkPlugin } from '../../../interfaces/signalk-plugin-config.interfaces';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';


@Component({
    selector: 'settings-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.scss'],
    imports: [
        FormsModule,
        MatDivider,
        MatButton,
        MatSliderModule,
        MatExpansionModule,
        MatInputModule,
        MatSlideToggleModule,
        MatSelectModule
    ],
})
export class SettingsDisplayComponent implements OnInit {
  private readonly DERIVED_DATA_PLUGIN_ID = 'derived-data';
  readonly displayForm = viewChild<NgForm>('displayForm');
  private _app = inject(AppService);
  private toast = inject(ToastService);
  private _settings = inject(SettingsService);
  private _responsive = inject(BreakpointObserver);
  private _pluginConfig = inject(SignalkPluginConfigService);
  protected isPhonePortrait: Signal<BreakpointState>;
  protected nightBrightness = signal<number>(0.27);
  protected autoNightMode = model<boolean>(false);
  protected isRedNightMode = model<boolean>(false);
  protected isLightTheme = model<boolean>(false);
  /* If true, the display can be remotely controlled by another KIP via Signal K displays path. */
  protected isRemoteControl = model<boolean>(false);
  protected instanceName = model<string>('');
  // Freeboard split shell config
  protected splitShellEnabled = model<boolean>(false);
  protected splitShellSide = model<'left' | 'right'>('left');
  protected splitShellSwipeDisabled = model<boolean>(false);
  // Guards concurrent plugin enable checks to avoid stale promise handlers mutating state
  private _pluginCheckSeq = 0;
  readonly LIGHT_THEME_NAME = "light-theme";
  readonly RED_NIGHT_MODE_THEME_NAME = "night-theme";

  constructor() {
    this.isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));
  }

  ngOnInit() {
    this.nightBrightness.set(this._settings.getNightModeBrightness());
    this.autoNightMode.set(this._settings.getAutoNightMode());
    this.isLightTheme.set(this._settings.getThemeName() === this.LIGHT_THEME_NAME);
    this.isRedNightMode.set(this._settings.getRedNightMode());
    this.isRemoteControl.set(this._settings.getIsRemoteControl());
    this.instanceName.set(this._settings.getInstanceName());
    this.splitShellEnabled.set(this._settings.getSplitShellEnabled());
    this.splitShellSide.set(this._settings.getSplitShellSide());
    this.splitShellSwipeDisabled.set(this._settings.getSplitShellSwipeDisabled());
  }

  protected saveAllSettings():void {
    const form = this.displayForm();
    if (!form || form.invalid) {
      form?.form.markAllAsTouched();
      this.toast.show('Please fill out required fields before saving.', 3000, true);
      return;
    }

    // If auto night mode is enabled, validate plugin requirements before saving
    if (this.autoNightMode()) {
      const seq = ++this._pluginCheckSeq;
      void this.validateAndSaveSettings(seq);
      return;
    }

    this.applyAndSaveSettings();
  }

  private applyAndSaveSettings(): void {
    this._settings.setAutoNightMode(this.autoNightMode());
    this._settings.setRedNightMode(this.isRedNightMode());
    this._settings.setNightModeBrightness(this.nightBrightness());
    this._settings.setIsRemoteControl(this.isRemoteControl());
    if (this.isRemoteControl()) {
      this._settings.setInstanceName(this.instanceName());
    } else {
      // If remote control is disabled, reset instance name
      this._settings.setInstanceName('');
    }

    if (!this._app.isNightMode()) {
      this._app.setBrightness(1);
    }
    if (this.isLightTheme()) {
    this._settings.setThemeName(this.LIGHT_THEME_NAME);
    } else {
      this._settings.setThemeName("");
    }
    this._settings.setSplitShellEnabled(this.splitShellEnabled());
    this._settings.setSplitShellSide(this.splitShellSide());
    this._settings.setSplitShellSwipeDisabled(this.splitShellSwipeDisabled());

    this.displayForm().form.markAsPristine();
    this.toast.show("Configuration saved", 1000, true, 'message');
  }

  private async validateAndSaveSettings(seq: number): Promise<void> {
    const isValid = await this.validateAndHandleAutoNightRequirement(seq);
    if (seq !== this._pluginCheckSeq) return;

    if (isValid) {
      this.applyAndSaveSettings();
    } else {
      // Reset toggle and abort save
      this.autoNightMode.set(false);
    }
  }

  protected isAutoNightModeSupported(e: MatSlideToggleChange): void {
    this.displayForm().form.markAsDirty();
    this.autoNightMode.set(e.checked);
  }

  private async validateAndHandleAutoNightRequirement(seq: number): Promise<boolean> {
    const pluginResult = await this._pluginConfig.getPlugin(this.DERIVED_DATA_PLUGIN_ID);
    if (seq !== this._pluginCheckSeq) return false;

    if (!pluginResult.ok) {
      const pluginFailure = pluginResult as IPluginApiFailure;
      if (pluginFailure.error.reason === 'not-found') {
        this.toast.show(
          'Automatic Night Mode requires the Signal K Derived Data plugin. This requirement is missing and must be installed manually by the user.',
          0,
          false,
          'error'
        );
        return false;
      }

      this.toast.show(
        `Failed to validate Automatic Night Mode requirements: ${pluginFailure.error.message}`,
        0,
        false,
        'error'
      );
      return false;
    }

    const plugin = pluginResult.data;
    const sunFlagPath = this.resolveEnvironmentSunFlagPath(plugin.state.configuration);
    const isSunFlagEnabled = this.readBooleanByPath(plugin.state.configuration, sunFlagPath) === true;

    if (plugin.state.enabled && isSunFlagEnabled) {
      return true;
    }

    // Build precise message based on what needs to be changed
    const needsEnable = !plugin.state.enabled;
    const needsSunFlag = !isSunFlagEnabled;
    let message: string;

    if (needsEnable && needsSunFlag) {
      message = "To enable Automatic Night Mode, the Derived Data plugin must be enabled and the environment.sun path must be set to true. Do you wish to enable & configure?";
    } else if (needsEnable) {
      message = "To enable Automatic Night Mode, the Derived Data plugin must be enabled. Do you wish to enable it?";
    } else {
      message = "To enable Automatic Night Mode, the environment.sun path in the Derived Data plugin must be set to true. Do you wish to configure it?";
    }

    return new Promise<boolean>((resolve) => {
      const promptRef = this.toast.show(message, 0, false, 'warn', 'Ok');

      promptRef.onAction().subscribe(() => {
        void this.enableAndConfigureAutoNight(plugin, sunFlagPath, seq, resolve);
      });

      promptRef.afterDismissed().subscribe((dismissal) => {
        if (!dismissal.dismissedByAction) {
          resolve(false);
        }
      });
    });
  }

  private async enableAndConfigureAutoNight(plugin: ISignalkPlugin, sunFlagPath: string[], seq: number, resolve: (value: boolean) => void): Promise<void> {
    const nextConfiguration = this.cloneConfig(plugin.state.configuration);
    this.writeBooleanByPath(nextConfiguration, sunFlagPath, true);

    const saveResult = await this._pluginConfig.savePluginConfig(plugin.id, {
      configuration: nextConfiguration,
      enabled: true
    });

    if (seq !== this._pluginCheckSeq) {
      resolve(false);
      return;
    }

    if (!saveResult.ok) {
      const saveFailure = saveResult as IPluginApiFailure;
      this.toast.show(
        `Failed to enable and configure Derived Data plugin: ${saveFailure.error.message}`,
        0,
        false,
        'error'
      );
      resolve(false);
      return;
    }

    this.toast.show('Automatic Night Mode dependency enabled and configured.', 3000, true, 'success');
    resolve(true);
  }

  private resolveEnvironmentSunFlagPath(configuration: Record<string, unknown>): string[] {
    const detectedPath = this.findBooleanSunPath(configuration);
    return detectedPath ?? ['sun'];
  }

  private findBooleanSunPath(obj: Record<string, unknown>, pathPrefix: string[] = []): string[] | null {
    const exactSunBoolean = Object.entries(obj).find(([key, value]) => key.toLowerCase() === 'sun' && typeof value === 'boolean');
    if (exactSunBoolean) {
      return [...pathPrefix, exactSunBoolean[0]];
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean' && key.toLowerCase().includes('sun')) {
        return [...pathPrefix, key];
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.findBooleanSunPath(value as Record<string, unknown>, [...pathPrefix, key]);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  }

  private readBooleanByPath(obj: Record<string, unknown>, path: string[]): boolean | null {
    let current: unknown = obj;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'boolean' ? current : null;
  }

  private writeBooleanByPath(obj: Record<string, unknown>, path: string[], value: boolean): void {
    if (path.length === 0) return;

    let current: Record<string, unknown> = obj;
    for (let index = 0; index < path.length - 1; index++) {
      const key = path[index];
      const next = current[key];
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
  }

  private cloneConfig(configuration: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(configuration || {})) as Record<string, unknown>;
  }

  protected setBrightness(value: number): void {
    this.displayForm().form.markAsDirty();
    this.nightBrightness.set(value);
    this._app.setBrightness(value, this._app.isNightMode());
  }
}
