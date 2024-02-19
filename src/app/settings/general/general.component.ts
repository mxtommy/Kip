import { Component, OnInit } from '@angular/core';
import { INotificationConfig } from '../../core/interfaces/app-settings.interfaces';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { NotificationsService } from '../../core/services/notifications.service';


@Component({
  selector: 'settings-general',
  templateUrl: './general.component.html',
  styleUrls: ['./general.component.css'],
})
export class SettingsGeneralComponent implements OnInit {

  public notificationConfig: INotificationConfig;
  public autoNightModeConfig: boolean;

  constructor(
    private notifications: NotificationsService,
    private app: AppService,
    private settings: AppSettingsService,
  ) { }

  ngOnInit() {
    this.notificationConfig = this.settings.getNotificationConfig();
    this.autoNightModeConfig = this.app.autoNightMode;
  }

  public saveAllSettings():void {
    try {
      this.saveNotificationsSettings();
      this.saveAutoNightMode();
      this.notifications.sendSnackbarNotification("General settings saved", 5000, false);
    } catch (error) {
      this.notifications.sendSnackbarNotification("Error saving settings: " + error, 5000, false);
    }

  }

  public saveNotificationsSettings(): void {
    this.settings.setNotificationConfig(this.notificationConfig);
  }

  public saveAutoNightMode() {
    this.app.autoNightModeConfig = this.autoNightModeConfig;
  }

  public isAutoNightPathSupported(event):void {
    if (event.checked) {
      if (!this.app.validateAutoNighModeSupported()) {
        this.autoNightModeConfig = false;
      }
    }
  }
}
