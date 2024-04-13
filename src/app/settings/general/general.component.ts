import { cloneDeep } from 'lodash-es';
import { Component, OnInit, ViewChild } from '@angular/core';
import { INotificationConfig } from '../../core/interfaces/app-settings.interfaces';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { FormsModule, NgForm } from '@angular/forms';


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
    ],
})
export class SettingsGeneralComponent implements OnInit {
  @ViewChild('generalForm') generalForm: NgForm;
  @ViewChild('statePanel') statePanel: MatExpansionPanel;
  @ViewChild('soundPanel') soundPanel: MatExpansionPanel;
  public notificationConfig: INotificationConfig;
  public autoNightModeConfig: boolean;
  public enableHighContrast: boolean = null;
  public notificationDisabledExpandPanel: boolean = false;

  constructor(
    private app: AppService,
    private settings: AppSettingsService,
  ) { }

  ngOnInit() {
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
    this.enableHighContrast ? this.settings.setThemeName("high-contrast") : this.settings.setThemeName("modernDark")
    this.generalForm.form.markAsPristine();
    this.app.sendSnackbarNotification("General configuration saved", 5000, false);
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
