import { Component, inject, OnInit, viewChild, signal, Signal, model, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { AppService } from '../../../services/app-service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { PluginConfigClientService } from '../../../services/plugin-config-client.service';
import { IPluginApiFailure, IPluginConfigSaveRequest, ISignalkPlugin } from '../../../interfaces/signalk-plugin-config.interfaces';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { SignalKConnectionService } from '../../../services/signalk-connection.service';
import { compare } from 'compare-versions';


@Component({
    selector: 'settings-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.scss'],
    imports: [
        FormsModule,
        MatDividerModule,
        MatButtonModule,
        MatSliderModule,
        MatExpansionModule,
        MatInputModule,
        MatSlideToggleModule,
        MatSelectModule,
        MatRadioModule
    ],
})
export class SettingsDisplayComponent implements OnInit {
  private readonly DERIVED_DATA_PLUGIN_ID = 'derived-data';
  private readonly KIP_DATA_PLUGIN_ID = 'kip';
  private readonly LIGHT_THEME_NAME = "light-theme";
  private readonly displayForm = viewChild<NgForm>('displayForm');
  private readonly app = inject(AppService);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(SettingsService);
  private readonly responsive = inject(BreakpointObserver);
  private readonly pluginConfig = inject(PluginConfigClientService);
  private readonly server = inject(SignalKConnectionService);
  protected isPhonePortrait: Signal<BreakpointState>;
  protected nightBrightness = signal<number>(0.27);
  protected isHistoryApiSupported = computed<boolean>(() => {
    const version = this.server.serverVersion$.getValue();
    return version ? compare(version, '2.22.1', ">=") : false;
  });
  protected autoNightMode = model<boolean>(false);
  protected isRedNightMode = model<boolean>(false);
  protected isLightTheme = model<boolean>(false);
  protected isRemoteControl = model<boolean>(false);
  protected instanceName = model<string>('');
  protected splitShellEnabled = model<boolean>(false);
  protected splitShellSide = model<'left' | 'right'>('left');
  protected splitShellSwipeDisabled = model<boolean>(false);
  protected providerMode = model<'kip' | 'other'>('other');
  protected widgetHistoryDisabled = model<boolean>(false);
  protected isKipHistoryProviderSelectable = signal<boolean>(false);
  // Guards concurrent plugin enable checks to avoid stale promise handlers mutating state
  private _pluginCheckSeq = 0;

  constructor() {
    this.isPhonePortrait = toSignal(this.responsive.observe(Breakpoints.HandsetPortrait));
  }

  ngOnInit() {
    this.nightBrightness.set(this.settings.getNightModeBrightness());
    this.autoNightMode.set(this.settings.getAutoNightMode());
    this.isLightTheme.set(this.settings.getThemeName() === this.LIGHT_THEME_NAME);
    this.isRedNightMode.set(this.settings.getRedNightMode());
    this.isRemoteControl.set(this.settings.getIsRemoteControl());
    this.instanceName.set(this.settings.getInstanceName());
    this.splitShellEnabled.set(this.settings.getSplitShellEnabled());
    this.splitShellSide.set(this.settings.getSplitShellSide());
    this.splitShellSwipeDisabled.set(this.settings.getSplitShellSwipeDisabled());
    this.widgetHistoryDisabled.set(this.settings.getWidgetHistoryDisabled());
    void this.getKipPluginConfig();
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
    this.settings.setAutoNightMode(this.autoNightMode());
    this.settings.setRedNightMode(this.isRedNightMode());
    this.settings.setNightModeBrightness(this.nightBrightness());
    this.settings.setIsRemoteControl(this.isRemoteControl());
    if (this.isRemoteControl()) {
      this.settings.setInstanceName(this.instanceName());
    } else {
      // If remote control is disabled, reset instance name
      this.settings.setInstanceName('');
    }

    if (!this.app.isNightMode()) {
      this.app.setBrightness(1);
    }
    if (this.isLightTheme()) {
    this.settings.setThemeName(this.LIGHT_THEME_NAME);
    } else {
      this.settings.setThemeName("");
    }
    this.settings.setSplitShellEnabled(this.splitShellEnabled());
    this.settings.setSplitShellSide(this.splitShellSide());
    this.settings.setSplitShellSwipeDisabled(this.splitShellSwipeDisabled());
    this.settings.setWidgetHistoryDisabled(this.widgetHistoryDisabled());
    if (!this.setKipPluginConfig()) {
      this.toast.show('Failed to save KIP plugin configuration on server.', 0, false, 'error');
    }
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

  private async getKipPluginConfig(): Promise<void> {
    const result = await this.pluginConfig.getPlugin(this.KIP_DATA_PLUGIN_ID);
    if (!result.ok) {
      this.toast.show(
        `Failed to load KIP plugin configuration: ${(result as IPluginApiFailure).error.message}`,
        0,
        false,
        'error'
      );
      return;
    }

    const pluginConfig = result.data.state.configuration;
    const seriesEnabled = pluginConfig.historySeriesServiceEnabled === true;
    this.isKipHistoryProviderSelectable.set((pluginConfig.nodeSqliteAvailable as boolean) ?? false);
    this.providerMode.set(seriesEnabled && this.isKipHistoryProviderSelectable() ? 'kip' : 'other');

  }

  private async setKipPluginConfig(): Promise<boolean> {
    const providerEnabled = this.isKipHistoryProviderSelectable();
    const useKipProvider = this.providerMode() === 'kip' && providerEnabled;
    const config: IPluginConfigSaveRequest = {
      configuration: {
        historySeriesServiceEnabled: useKipProvider,
        registerAsHistoryApiProvider: useKipProvider
      }
    };
    const result = await this.pluginConfig.savePluginConfig(this.KIP_DATA_PLUGIN_ID, config);
    return result.ok;
  }

  protected isAutoNightModeSupported(e: MatSlideToggleChange): void {
    this.displayForm().form.markAsDirty();
    this.autoNightMode.set(e.checked);
  }

  private async validateAndHandleAutoNightRequirement(seq: number): Promise<boolean> {
    const pluginResult = await this.pluginConfig.getPlugin(this.DERIVED_DATA_PLUGIN_ID);
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
      message = "To enable Automatic Night Mode, the Derived Data plugin must be enabled and the environment.sun path must be set to true. Do you wish to enable & and activate the path?";
    } else if (needsEnable) {
      message = "To enable Automatic Night Mode, the Derived Data plugin must be enabled. Do you wish to enable the plugin?";
    } else {
      message = "To enable Automatic Night Mode, the environment.sun path in the Derived Data plugin must be activated. Do you wish to activate the path?";
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

    const saveResult = await this.pluginConfig.savePluginConfig(plugin.id, {
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
    this.app.setBrightness(value, this.app.isNightMode());
  }
}
