import { Component, inject, OnInit, viewChild } from '@angular/core';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'settings-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.css'],
    standalone: true,
    imports: [
        FormsModule,
        MatCheckbox,
        MatDivider,
        MatButton,
        MatSliderModule,
    ],
})
export class SettingsDisplayComponent implements OnInit {
  readonly displayForm = viewChild<NgForm>('displayForm');
  public nightBrightness: number = 0.3;
  public autoNightMode: boolean = false;
  private _app = inject(AppService);
  private _settings = inject(AppSettingsService);
  protected isLightTheme = false;

  ngOnInit() {
    this.nightBrightness = this._settings.getNightModeBrightness();
    this.autoNightMode = this._settings.getAutoNightMode();
    this.isLightTheme = this._settings.getThemeName() === "light-theme";
  }

  protected saveAllSettings():void {
    this._settings.setAutoNightMode(this.autoNightMode);
    this._settings.setNightModeBrightness(this.nightBrightness);
    this.displayForm().form.markAsPristine();
    if (!this._app.isNightMode()) {
      this._app.setBrightness(1);
    }
    if (this.isLightTheme) {
    this._settings.setThemeName("light-theme");
    } else {
      this._settings.setThemeName("");
    }
  }

  protected isAutoNightModeSupported(e: MatCheckboxChange): void {
    if (e.checked) {
      this._app.validateAutoNightModeSupported();
    }
  }

  protected setBrightness(value: number): void {
    this.displayForm().form.markAsDirty();
    this.nightBrightness = value;
    this._app.setBrightness(value, this._app.isNightMode());
  }
}
