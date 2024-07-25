import { Component, OnInit, ViewChild } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { INotificationConfig } from '../../core/interfaces/app-settings.interfaces';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { FormsModule, NgForm } from '@angular/forms';


@Component({
    selector: 'settings-notifications',
    templateUrl: './notifications.component.html',
    styleUrls: ['./notifications.component.css'],
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
export class SettingsNotificationsComponent implements OnInit {
  @ViewChild('notificationsForm') notificationsForm: NgForm;
  @ViewChild('statePanel') statePanel: MatExpansionPanel;
  @ViewChild('soundPanel') soundPanel: MatExpansionPanel;
  public notificationConfig: INotificationConfig;
  public notificationDisabledExpandPanel: boolean = false;

  constructor(
    private app: AppService,
    private settings: AppSettingsService,
  ) { }

  ngOnInit() {
    this.notificationConfig = cloneDeep(this.settings.getNotificationConfig());
  }

  public saveAllSettings():void {
    this.settings.setNotificationConfig(cloneDeep(this.notificationConfig));
    this.notificationsForm.form.markAsPristine();
    this.app.sendSnackbarNotification("Configuration saved", 5000, false);
  }

  public togglePanel(e: MatSlideToggleChange): void {
    if(e.checked) {
      this.notificationDisabledExpandPanel = false;
      this.statePanel.close();
      this.soundPanel.close();
    }
  }
}
