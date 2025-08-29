import { Component, viewChild, inject, Signal } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { INotificationConfig } from '../../../interfaces/app-settings.interfaces';
import { AppService } from '../../../services/app-service';
import { AppSettingsService } from '../../../services/app-settings.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { FormsModule, NgForm } from '@angular/forms';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';


@Component({
    selector: 'settings-notifications',
    templateUrl: './notifications.component.html',
    styleUrls: ['./notifications.component.scss'],

    imports: [
        FormsModule,
        MatCheckbox,
        MatSlideToggleModule,
        MatExpansionModule,
        MatDivider,
        MatButton,
    ],
})
export class SettingsNotificationsComponent {
  private app = inject(AppService);
  private settings = inject(AppSettingsService);
  private _responsive = inject(BreakpointObserver);
  protected isPhonePortrait: Signal<BreakpointState>;
  readonly notificationsForm = viewChild<NgForm>('notificationsForm');
  readonly statePanel = viewChild<MatExpansionPanel>('statePanel');
  readonly soundPanel = viewChild<MatExpansionPanel>('soundPanel');
  public notificationConfig: INotificationConfig;
  public notificationDisabledExpandPanel = false;

  constructor() {
    this.isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));
    this.notificationConfig = cloneDeep(this.settings.getNotificationConfig());
  }

  public saveAllSettings():void {
    this.settings.setNotificationConfig(cloneDeep(this.notificationConfig));
    this.notificationsForm().form.markAsPristine();
    this.app.sendSnackbarNotification("Configuration saved", 3000, false);
  }

  public togglePanel(e: MatSlideToggleChange): void {
    if(e.checked) {
      this.notificationDisabledExpandPanel = false;
      this.statePanel().close();
      this.soundPanel().close();
    }
  }
}
