import { Component, ElementRef, Inject, OnInit, Renderer2, ViewChild } from '@angular/core';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule, NgForm } from '@angular/forms';
import { DOCUMENT } from '@angular/common';

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
  @ViewChild('displayForm') displayForm: NgForm;
  public brightness: number = 1;
  public autoNightModeConfig: boolean;
  public enableHighContrast: boolean = null;

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    @Inject(DOCUMENT) private document: Document,
    private app: AppService,
    private settings: AppSettingsService,
  ) { }

  ngOnInit() {
    this.brightness = this.settings.getNightModeBrightness();
    this.autoNightModeConfig = this.app.autoNightMode;
    this.enableHighContrast = (this.settings.getThemeName() == "high-contrast") ? true : false;
  }

  public saveAllSettings():void {
    if (this.app.validateAutoNightModeSupported()) {
      this.app.autoNightModeConfig = this.autoNightModeConfig;
    } else {
      this.app.autoNightModeConfig = this.autoNightModeConfig = false;
    }
    this.enableHighContrast ? this.settings.setThemeName("high-contrast") : this.settings.setThemeName("modernDark");
    this.settings.setNightModeBrightness(this.brightness);
    this.displayForm.form.markAsPristine();
    this.app.sendSnackbarNotification("Configuration saved", 5000, false);
  }

  setBrightness(value: number): void {
    this.brightness = value;
    const root = document.documentElement;
    root.style.setProperty('--kip-nightModeBrightness', `${this.brightness}`);
  }

  public setTheme(e: MatCheckboxChange) {
    this.enableHighContrast = e.checked;
  }
}
