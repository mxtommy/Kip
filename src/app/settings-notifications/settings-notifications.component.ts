import { Component, OnInit } from '@angular/core';
import { AppSettingsService, INotificationConfig } from '../app-settings.service';


@Component({
  selector: 'settings-notifications',
  templateUrl: './settings-notifications.component.html',
  styleUrls: ['./settings-notifications.component.css']
})
export class SettingsNotificationsComponent implements OnInit {

  notificationConfig: INotificationConfig;

  constructor(
    private appSettingsService: AppSettingsService,
  ) { }

  ngOnInit() {
    this.notificationConfig = this.appSettingsService.getNotificationConfig();
  }

  saveNotificationsSettings() {
    this.appSettingsService.setNotificationConfig(this.notificationConfig);
  }

}
