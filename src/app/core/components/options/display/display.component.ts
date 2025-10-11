import { Component, inject, OnInit, viewChild, signal, Signal, model } from '@angular/core';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { AppService } from '../../../services/app-service';
import { AppSettingsService } from '../../../services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { toSignal } from '@angular/core/rxjs-interop';
import { SignalkPluginsService } from '../../../services/signalk-plugins.service';
import { DataService } from '../../../services/data.service';
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
  readonly MODE_PATH: string = 'self.environment.mode';
  readonly displayForm = viewChild<NgForm>('displayForm');
  private _app = inject(AppService);
  private _settings = inject(AppSettingsService);
  private _responsive = inject(BreakpointObserver);
  private _plugins = inject(SignalkPluginsService);
  private _data = inject(DataService);
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
    this._app.sendSnackbarNotification("Configuration saved", 3000, false);
  }

  protected isAutoNightModeSupported(e: MatSlideToggleChange): void {
    this.displayForm().form.markAsDirty();
    // If user unchecked, immediately disable and abort
    if (!e.checked) {
      this.autoNightMode.set(false);
      return;
    }
    const seq = ++this._pluginCheckSeq; // capture sequence for this async request
    this._plugins.isEnabled('derived-data')
      .then((enabled) => {
        if (seq !== this._pluginCheckSeq) return; // stale response; ignore
        if (!enabled) {
          this.autoNightMode.set(false);
          this._app.sendSnackbarNotification(
            "Plugin Error: To enable Automatic Night Mode, verify that: 1) The Signal K Derived Data plugin is installed and enabled on the server. 2) The plugin's Sun: Sets environment.sun parameter is enabled. Restart the Signal K server and try again.",
            0
          );
          return;
        }
        const supported = this.validateAutoNightModeSupported();
        this.autoNightMode.set(supported);
      })
      .catch((error) => {
        if (seq !== this._pluginCheckSeq) return;
        console.error('[Display Component] Error checking plugin status:', error);
        this.autoNightMode.set(false);
      });
  }

  /**
   * Check if the browser supports the automatic night mode feature.
   * This is a helper method to check if the browser supports the
   * matchMedia API and the prefers-color-scheme media query.
   */
  public  validateAutoNightModeSupported(): boolean {
    if (!this._data.getPathObject(this.MODE_PATH)) {
      this._app.sendSnackbarNotification("Path Error: In Signal K, locate the Derived Data plugin and enable the 'Sets environment.sun' parameter under the 'Sun' group. Restart the Signal K server and try again.", 0);
      return false;
    }
    return true;
  }

  protected setBrightness(value: number): void {
    this.displayForm().form.markAsDirty();
    this.nightBrightness.set(value);
    this._app.setBrightness(value, this._app.isNightMode());
  }
}
