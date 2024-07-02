import { cloneDeep } from 'lodash-es';
import { Component, ElementRef, Inject, OnInit, Renderer2, ViewChild } from '@angular/core';
import { INotificationConfig } from '../../core/interfaces/app-settings.interfaces';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { FormsModule, NgForm } from '@angular/forms';
import { DOCUMENT } from '@angular/common';

@Component({
    selector: 'settings-general',
    templateUrl: './general.component.html',
    styleUrls: ['./general.component.css'],
    standalone: true,

    imports: [
        FormsModule,
        MatCheckbox,
        MatSlideToggleModule,
        MatExpansionModule,
        MatDivider,
        MatButton,
        MatSliderModule,
        MatSlideToggleModule
    ],
})
export class SettingsGeneralComponent implements OnInit {
  @ViewChild('generalForm') generalForm: NgForm;
  @ViewChild('statePanel') statePanel: MatExpansionPanel;
  @ViewChild('soundPanel') soundPanel: MatExpansionPanel;
  public brightness: number = 1;
  public notificationConfig: INotificationConfig;
  public autoNightModeConfig: boolean;
  public enableHighContrast: boolean = null;
  public notificationDisabledExpandPanel: boolean = false;

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    @Inject(DOCUMENT) private document: Document,
    private app: AppService,
    private settings: AppSettingsService,
  ) { }

  ngOnInit() {
    this.brightness = this.settings.getNightModeBrightness();
    this.notificationConfig = cloneDeep(this.settings.getNotificationConfig());
    this.autoNightModeConfig = this.app.autoNightMode;
    this.enableHighContrast = (this.settings.getThemeName() == "high-contrast") ? true : false;
  }

  public saveAllSettings():void {
    this.settings.setNotificationConfig(cloneDeep(this.notificationConfig));
    if (this.app.validateAutoNightModeSupported()) {
      this.app.autoNightModeConfig = this.autoNightModeConfig;
    } else {
      this.app.autoNightModeConfig = this.autoNightModeConfig = false;
    }
    this.enableHighContrast ? this.settings.setThemeName("high-contrast") : this.settings.setThemeName("modernDark");
    this.settings.setNightModeBrightness(this.brightness);
    this.generalForm.form.markAsPristine();
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

  public togglePanel(e: MatSlideToggleChange): void {
    if(e.checked) {
      this.notificationDisabledExpandPanel = false;
      this.statePanel.close();
      this.soundPanel.close();
    }
  }
}
