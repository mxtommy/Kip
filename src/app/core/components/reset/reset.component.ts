import { Component } from '@angular/core';
import { AppSettingsService } from '../../services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { PageHeaderComponent } from "../page-header/page-header.component";

@Component({
    selector: 'settings-reset',
    templateUrl: './reset.component.html',
    styleUrls: ['./reset.component.scss'],
    standalone: true,
    imports: [MatButton, PageHeaderComponent]
})
export class SettingsResetComponent {
  protected readonly pageTitle: string = "Reset";
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
