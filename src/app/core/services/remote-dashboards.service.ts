import { effect, inject, Injectable, untracked } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { IV2CommandResponse } from '../interfaces/signalk-autopilot-interfaces';
import { HttpClient } from '@angular/common/http';
import { AppSettingsService } from './app-settings.service';
import { DashboardService, Dashboard } from './dashboard.service';
import { DataService } from './data.service';
import { toSignal } from '@angular/core/rxjs-interop';

export type DashboardListItem = Omit<Dashboard, 'configuration'>;
export interface IScreensPayload {
  displayName: string;
  screens: DashboardListItem[];
}

@Injectable({
  providedIn: 'root'
})
export class RemoteDashboardsService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(AppSettingsService);
  private readonly dashboard = inject(DashboardService);
  private readonly data = inject(DataService);

  private readonly KIP_UUID = this.settings.KipUUID;
  private readonly ACTIVE_SCREEN_PATH = `self.displays.${this.KIP_UUID}.screenIndex`;
  private readonly CHANGE_SCREEN_PATH = `self.displays.${this.KIP_UUID}.activeScreen`;

  private readonly displayName = toSignal(this.settings.getInstanceNameAsO());
  private readonly isRemoteControl = toSignal(this.settings.getIsRemoteControlAsO());
  private readonly remoteScreenPosition = toSignal(this.data.subscribePath(this.ACTIVE_SCREEN_PATH, 'default'));
  private readonly changeDashboardTo = toSignal(this.data.subscribePath(this.CHANGE_SCREEN_PATH, 'default'));
  private readonly PLUGIN_URL = this.settings.signalkUrl.url + '/plugins/kip';
  private previousIsRemoteControl = false;

  constructor() {
    // Clear all remote paths on service initialization
    this.setActiveDashboardOnRemote(this.KIP_UUID, null);
    this.setScreensOnRemote(this.KIP_UUID, null);
    this.clearActiveScreenOnRemote(this.KIP_UUID, null);
    console.log('[Remote Dashboards] Cleaning paths on server');

    // Share dashboards configuration when Remote Control is toggled or when display name changes
    effect(() => {
      const isRemoteControl = this.isRemoteControl();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const displayName = this.displayName();

      untracked(() => {
        if (!isRemoteControl && !this.previousIsRemoteControl) return;
        this.previousIsRemoteControl = isRemoteControl;
        let screensPayload: IScreensPayload = undefined;
        if (!isRemoteControl) {
          // Clear displayName and screens on the server
          screensPayload = null;
          this.clearActiveDashboardOnServer();
        } else {
          screensPayload = this.getScreensPayload(this.dashboard.dashboards());
          const activeDashboard = this.dashboard.activeDashboard()
          if (activeDashboard !== null) {
            this.setActiveDashboardOnRemote(this.KIP_UUID, this.dashboard.activeDashboard())
              .catch((err) => {
                console.error('[Remote Dashboards] Error sharing active dashboard on Remote Control activation:', err);
              });
          }
        }

        this.shareScreens(screensPayload);
      });
    });

    // Push dashboard configuration to remote
    effect(() => {
      const dashboards = this.dashboard.dashboards();

      untracked(() => {
        if (!this.isRemoteControl()) return;
        const screensPayload = this.getScreensPayload(dashboards);
        this.shareScreens(screensPayload);
      });
    });

    // Push active dashboard to remote
    effect(() => {
      const activeIdx = this.dashboard.activeDashboard();

      untracked(() => {
        if (!this.isRemoteControl()) return;
        if (activeIdx === null) return;

        this.setActiveDashboardOnRemote(this.KIP_UUID, activeIdx)
          .then(() => {
            console.log(`[Remote Dashboards] Sent new dashboard highlight index ${activeIdx} to server.`);
          })
          .catch((err) => {
            console.error('[Remote Dashboards] Error sharing active dashboard:', err);
          });
      });
    });

    // Change active dashboard based on remote updates
    effect(() => {
      const changeTo = this.changeDashboardTo();

      untracked(() => {
        if (!this.isRemoteControl()) return;
        if (changeTo.data.value == null) return;
        const idx = Number(changeTo.data.value);
        if (!isNaN(idx) && idx >= 0 && idx < this.dashboard.dashboards().length) {
          if (this.dashboard.activeDashboard() !== idx) {
            this.dashboard.navigateTo(idx);
            console.log(`[Remote Dashboards] Executed remote request to change active dashboard to: ${idx}`);
          }
        }
      });
    });
  }

  private clearActiveDashboardOnServer() {
    this.setActiveDashboardOnRemote(this.KIP_UUID, null).then(() => {
      console.log('[Remote Dashboards] Disabled: Cleared active dashboard on server');
    }).catch((err) => {
      console.error('[Remote Dashboards] Error clearing active dashboard on server while disabling the feature:', err);
    });
  }

  private getScreensPayload(dashboards: Dashboard[]): IScreensPayload {
    const displayName = this.displayName();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const dashboardListItems: DashboardListItem[] = dashboards.map(({ configuration, ...rest }) => rest);
    return { displayName: displayName, screens: dashboardListItems };
  }

  private shareScreens(screens: IScreensPayload): void {
    this.setScreensOnRemote(this.KIP_UUID, screens)
      .then(() => {
        console.log('[Remote Dashboards] Sending dashboard configurations to server.');
      }).catch((err) => {
        console.error('[Remote Dashboards] Error sharing screen configuration:', err);
      });
  }

  // Important API call info - the string screenIdx in { screenIdx } is important as the KIP Plugin looks for this string in the param. Do not change without updating the KIP Plugin.
  public async setActiveDashboardOnRemote(kipId: string, screenIdx: number | null): Promise<IV2CommandResponse> {
    const body = screenIdx === null ? null : { screenIdx };
    return lastValueFrom(
      this.http.put<IV2CommandResponse>(`${this.PLUGIN_URL}/displays/${kipId}/screenIndex`, body)
    );
  }

  public async setScreensOnRemote(kipId: string, screensPayload: IScreensPayload): Promise<IV2CommandResponse> {
    const body = screensPayload === null ? null : { ...screensPayload };
    return lastValueFrom(
      this.http.put<IV2CommandResponse>(`${this.PLUGIN_URL}/displays/${kipId}`, body)
    );
  }

  // Important API call info - the string screenIdx in { screenIdx } is important as the KIP Plugin looks for this string in the param. Do not change without updating the KIP Plugin.
  public async clearActiveScreenOnRemote(kipId: string, screenIdx: number | null): Promise<IV2CommandResponse> {
    const body = screenIdx === null ? null : { screenIdx };
    return lastValueFrom(
      this.http.put<IV2CommandResponse>(`${this.PLUGIN_URL}/displays/${kipId}/activeScreen`, body)
    );
  }
}
