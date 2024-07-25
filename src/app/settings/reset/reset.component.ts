import { Component } from '@angular/core';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'settings-reset',
    templateUrl: './reset.component.html',
    styleUrls: ['./reset.component.scss'],
    standalone: true,
    imports: [ MatButton ]
})
export class SettingsResetComponent {
  constructor(
    private appSettingsService: AppSettingsService,
  ) { }

  public resetConfigToDefault() {
    this.appSettingsService.resetSettings();
  }

  public resetConnectionToDefault() {
    this.appSettingsService.resetConnection();
  }

  public loadDemoConfig() {
    this.appSettingsService.loadDemoConfig();
  }
}
