import { IStreamStatus, SignalKDeltaService } from './signalk-delta.service';
import { NotificationsService } from './notifications.service';
import { IConnectionConfig } from '../interfaces/app-settings.interfaces';
import { AppSettingsService } from './app-settings.service';
import { Injectable } from '@angular/core';
import { SignalKService } from './signalk.service';
import { Observable } from 'rxjs';

const modePath: string = 'self.environment.mode';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  public autoNightMode: boolean; // from Config value
  private sunValue: string = 'day';
  private dayTheme: string;

  constructor(
    private settings: AppSettingsService,
    private delta: SignalKDeltaService,
    private sk: SignalKService,
    private notification: NotificationsService
  ) {
    this.autoNightMode = this.settings.getAutoNightMode();
    this.autoNightModeObserver();
  }

  private autoNightModeObserver(): void {
    let deltaStatus = this.delta.getDataStreamStatusAsO(); // wait for delta service to start
    deltaStatus.subscribe(stat => {
      stat as IStreamStatus;
      if(stat.operation == 2) {

        setTimeout(() => { // Wait for path data to come in on startup
          const autoNightMode: Observable<boolean> = this.settings.getAutoNightModeAsO();
          autoNightMode.subscribe(mode => {
            this.autoNightMode = mode;
            if (mode) {
              if (this.sk.getPathObject(modePath) !== null) {

                // capture none nightMode theme name changes
                this.settings.getThemeNameAsO().subscribe(theme => {
                  if (theme != 'nightMode')
                  this.dayTheme = theme;
                });

                const connConf: IConnectionConfig = this.settings.getConnectionConfig(); // get app UUUID

                this.sk.subscribePath(connConf.kipUUID, modePath, 'default').subscribe(mode => {
                  if (mode.value == 'night' && this.sunValue != mode.value) {
                    this.sunValue = mode.value;
                    this.settings.setThemName('nightMode');
                  } else if (mode.value == 'day' && this.sunValue != mode.value) {
                    this.sunValue = mode.value;
                    this.settings.setThemName(this.dayTheme);
                  }
                });
              }
            }
          });
        }, 0);
      }
    });
  }

  public validateAutoNighModeSupported(): boolean {
    if (this.sk.getPathObject(modePath) == null) {
      this.notification.sendSnackbarNotification("Dependency Error: self.environment.mode path was not found. To enable Automatic Night Mode, verify that the following Signal K requirements are met: 1) The Derived Data plugin is installed and enabled. 2) The plugin's Sun:Sets environment.sun parameter is checked.", 0);
      return false;
    }
    return true;
  }

  public set autoNightModeConfig(isEnabled : boolean) {
    this.settings.setAutoNightMode(isEnabled);
  }

}
