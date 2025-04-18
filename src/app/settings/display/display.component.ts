import { Component, inject, OnInit, viewChild, signal, Signal } from '@angular/core';
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
  readonly displayForm = viewChild<NgForm>('displayForm');
  private _app = inject(AppService);
  private _settings = inject(AppSettingsService);
  private _responsive = inject(BreakpointObserver);
  protected isPhonePortrait: Signal<BreakpointState>;
  protected nightBrightness = signal<number>(0.27);
  protected autoNightMode = signal<boolean>(false);
  protected isRedNightMode = signal<boolean>(false);
  protected isLightTheme = signal<boolean>(false);

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
      this._app.validateAutoNightModeSupported() ? this.autoNightMode.set(true) : this.autoNightMode.set(false);
    }
  }

  protected setBrightness(value: number): void {
    this.displayForm().form.markAsDirty();
    this.nightBrightness.set(value);
    this._app.setBrightness(value, this._app.isNightMode());
  }
}
