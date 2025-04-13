import { Component, OnInit, viewChild, inject } from '@angular/core';
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
    styleUrls: ['./notifications.component.scss'],
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
  private app = inject(AppService);
  private settings = inject(AppSettingsService);

  readonly notificationsForm = viewChild<NgForm>('notificationsForm');
  readonly statePanel = viewChild<MatExpansionPanel>('statePanel');
  readonly soundPanel = viewChild<MatExpansionPanel>('soundPanel');
  public notificationConfig: INotificationConfig;
  public notificationDisabledExpandPanel: boolean = false;

  ngOnInit() {
    this.notificationConfig = cloneDeep(this.settings.getNotificationConfig());
  }

  public saveAllSettings():void {
    this.settings.setNotificationConfig(cloneDeep(this.notificationConfig));
    this.notificationsForm().form.markAsPristine();
    this.app.sendSnackbarNotification("Configuration saved", 5000, false);
  }

  public togglePanel(e: MatSlideToggleChange): void {
    if(e.checked) {
      this.notificationDisabledExpandPanel = false;
      this.statePanel().close();
      this.soundPanel().close();
    }
  }
}
