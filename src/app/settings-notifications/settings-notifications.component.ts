import { Component, OnInit } from '@angular/core';
import { AppSettingsService } from '../app-settings.service';


@Component({
  selector: 'settings-notifications',
  templateUrl: './settings-notifications.component.html',
  styleUrls: ['./settings-notifications.component.css']
})
export class SettingsNotificationsComponent implements OnInit {

  disableNotifications: boolean;

  constructor(
    private appSettingsService: AppSettingsService,
  ) { }

  ngOnInit() {
    this.disableNotifications = this.appSettingsService.getNotificationServiceSettings();
  }

  saveNotificationsSettings() {
    this.appSettingsService.setNotificationServiceSettings(this.disableNotifications);
  }

}
