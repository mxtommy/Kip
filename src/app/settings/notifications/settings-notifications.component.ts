import { Component, OnInit } from '@angular/core';
import { INotificationConfig } from '../app-settings.interfaces';
import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';


@Component({
  selector: 'settings-notifications',
  templateUrl: './settings-notifications.component.html',
  styleUrls: ['./settings-notifications.component.css']
})
export class SettingsNotificationsComponent implements OnInit {

  notificationConfig: INotificationConfig;

  constructor(
    private notificationsService: NotificationsService,
    private appSettingsService: AppSettingsService,
  ) { }

  ngOnInit() {
    this.notificationConfig = this.appSettingsService.getNotificationConfig();
  }

  saveNotificationsSettings() {
    this.appSettingsService.setNotificationConfig(this.notificationConfig);
    this.notificationsService.sendSnackbarNotification("Notification configuration saved", 5000, false);
  }

}
