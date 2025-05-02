import { Component, inject, OnInit, viewChild, signal, Signal, model } from '@angular/core';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { toSignal } from '@angular/core/rxjs-interop';
import { SignalkPluginsService } from '../../core/services/signalk-plugins.service';
import { DataService } from '../../core/services/data.service';


@Component({
    selector: 'settings-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.scss'],
    standalone: true,
    imports: [
        FormsModule,
        MatCheckbox,
        MatDivider,
        MatButton,
        MatSliderModule,
        MatExpansionModule
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
  }

  protected saveAllSettings():void {
    this._settings.setAutoNightMode(this.autoNightMode());
    this._settings.setRedNightMode(this.isRedNightMode());
    this._settings.setNightModeBrightness(this.nightBrightness());
    this.displayForm().form.markAsPristine();

    if (!this._app.isNightMode()) {
      this._app.setBrightness(1);
    }
    if (this.isLightTheme()) {
    this._settings.setThemeName(this.LIGHT_THEME_NAME);
    } else {
      this._settings.setThemeName("");
    }
  }

  protected isAutoNightModeSupported(e: MatCheckboxChange): void {
    this.displayForm().form.markAsDirty();
    if (e.checked) {
      this._plugins.isEnabled('derived-data').then((enabled) => {
        if (enabled) {
          this.autoNightMode.set(true);
          this.validateAutoNightModeSupported() ? this.autoNightMode.set(true) : this.autoNightMode.set(false);
        } else {
          this._app.sendSnackbarNotification("Plugin Error: To enable Automatic Night Mode, verify that: 1) The Signal K Derived Data plugin is installed and enabled on the server. 2) The plugin's Sun: Sets environment.sun parameter is enabled. Restart the Signal K server and try again.", 0);
        }
      }).catch((error) => {
        console.error('[Display Component] Error checking plugin status:', error);
      });
    }
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
