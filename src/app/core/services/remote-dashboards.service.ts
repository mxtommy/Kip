import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { IV2CommandResponse } from '../interfaces/signalk-autopilot-interfaces';
import { HttpClient } from '@angular/common/http';
import { AppSettingsService } from './app-settings.service';
import { DashboardService, Dashboard } from './dashboard.service';
import { DataService } from './data.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

export type DashboardListItem = Omit<Dashboard, 'configuration'>;
export interface IScreensPayload {
  displayName: string;
  screens: DashboardListItem[];
}

@Injectable({
  providedIn: 'root'
})
export class RemoteDashboardsService {
  private readonly _http = inject(HttpClient);
  private readonly _settings = inject(AppSettingsService);
  private readonly _dashboard = inject(DashboardService);
  private readonly _data = inject(DataService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _displayName = toSignal(this._settings.getInstanceNameAsO());
  private readonly _isRemoteControl = toSignal(this._settings.getIsRemoteControlAsO());
  private readonly PLUGIN_URL = this._settings.signalkUrl.url + '/plugins/kip';
  private readonly KIP_UUID = this._settings.KipUUID;
  private readonly ACTIVE_SCREEN_PATH = `self.displays.${this.KIP_UUID}.activeScreen`;
  private previousIsRemoteControl = false;

  constructor() {
    effect(() => {
      // Whenever the dashboards or display name or remote control setting changes, share the new state with the server
      const isRemoteControl = this._isRemoteControl();
      if (!isRemoteControl && !this.previousIsRemoteControl) return;
      const displayName = this._displayName();
      const dashboards = this._dashboard.dashboards();

      untracked(() => {
        this.previousIsRemoteControl = isRemoteControl;
        let screensPayload: IScreensPayload = undefined;
        let activeDashboard: number = undefined;
        if (!isRemoteControl) {
          // If remote control is disabled, clear out the displayName, screens and activeScreen on the server
          screensPayload = null;
          activeDashboard = null;

        } else {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const dashboardListItems: DashboardListItem[] = dashboards.map(({ configuration, ...rest }) => rest);
          screensPayload = {
            displayName: displayName,
            screens: dashboardListItems
          };
          activeDashboard = this._dashboard.activeDashboard();
        }


        // Share the screens configuration with the server
        this.shareScreens(this.KIP_UUID, screensPayload).then(() => {
          console.log('[Remote Dashboards] Screens shared');
        }).catch((err) => {
          console.error('[Remote Dashboards] Error sharing screens:', err);
        });

        // If remote control is disabled, also clear out the activeScreen on the server
        this.setActiveDashboard(this.KIP_UUID, activeDashboard).then(() => {
          console.log('[Remote Dashboards] Shared active dashboard');
        }).catch((err) => {
          console.error('[Remote Dashboards] Error sharing active dashboard:', err);
        });
      });
    });

    effect(() => {
      // Whenever the active dashboard changes and remote control is enabled, share the new active dashboard with the server
      const isRemoteControl = this._isRemoteControl();
      if (!isRemoteControl) return;
      const activeIdx = this._dashboard.activeDashboard();
      untracked(() => {
        this.setActiveDashboard(this.KIP_UUID, activeIdx).then(() => {
          console.log('[Remote Dashboards] Shared active dashboard');
        }).catch((err) => {
          console.error('[Remote Dashboards] Error sharing active dashboard:', err);
        });
      });
    });

    this.setupRemoteControlListener();
  }

  private setupRemoteControlListener() {
    this._settings.getIsRemoteControlAsO()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(isRemote => {
        if (isRemote) {
          this._data.subscribePath(this.ACTIVE_SCREEN_PATH, 'default')
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(update => {
              if (update.data.value == null) return;
              const idx = Number(update.data.value);
              if (!isNaN(idx) && idx >= 0 && idx < this._dashboard.dashboards().length) {
                if (this._dashboard.activeDashboard() !== idx) {
                  console.log(`[Remote Dashboards] Setting active dashboard to ${idx} from remote update`);
                  this._dashboard.navigateTo(idx);
                }
              }
            });
        } else {
          this._data.unsubscribePath(this.ACTIVE_SCREEN_PATH);
        }
      });
  }

  public async setActiveDashboard(kipId: string, screenIdx: number | null): Promise<IV2CommandResponse> {
    const body = screenIdx === null ? null : { screenIdx };
    return lastValueFrom(
      this._http.put<IV2CommandResponse>(`${this.PLUGIN_URL}/displays/${kipId}/activeScreen`, body)
    );
  }

  public shareScreens(kipId: string, screensPayload: IScreensPayload): Promise<IV2CommandResponse> {
    const body = screensPayload === null ? null : { ...screensPayload };
    return lastValueFrom(
      this._http.put<IV2CommandResponse>(`${this.PLUGIN_URL}/displays/${kipId}`, body)
    );
  }
}
