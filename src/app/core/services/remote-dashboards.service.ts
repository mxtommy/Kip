import { effect, inject, Injectable, untracked } from '@angular/core';
import { SettingsService } from './settings.service';
import { DashboardService, Dashboard } from './dashboard.service';
import { DataService } from './data.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SignalkRequestsService } from './signalk-requests.service';

/**
 * Lightweight dashboard descriptor shared to remote displays.
 *
 * This removes heavy widget configuration payload from `Dashboard` before
 * publishing over Signal K remote control paths.
 *
 * @example
 * ```ts
 * const item: DashboardListItem = { id: 'dash-1', name: 'Nav', icon: 'sailing' } as DashboardListItem;
 * ```
 */
export type DashboardListItem = Omit<Dashboard, 'configuration'>;

/**
 * Payload published to a remote display describing available dashboards.
 *
 * @example
 * ```ts
 * const payload: IScreensPayload = {
 *   displayName: 'Helm Port',
 *   screens: [{ id: 'dash-1', name: 'Navigation', icon: 'sailing' } as DashboardListItem]
 * };
 * ```
 */
export interface IScreensPayload {
  /** Friendly display name shown to controllers. */
  displayName: string;
  /** Selectable dashboard list for the target display. */
  screens: DashboardListItem[];
}

interface IRemoteDisplayCommand {
  displayId: string;
  display: IScreensPayload | null;
}

interface IRemoteScreenCommand {
  displayId: string;
  screenIdx: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class RemoteDashboardsService {
  private readonly COMMAND_SET_DISPLAY_PATH = 'self.kip.remote.setDisplay';
  private readonly COMMAND_SET_SCREEN_INDEX_PATH = 'self.kip.remote.setScreenIndex';
  private readonly COMMAND_REQUEST_ACTIVE_SCREEN_PATH = 'self.kip.remote.requestActiveScreen';

  private readonly settings = inject(SettingsService);
  private readonly dashboard = inject(DashboardService);
  private readonly data = inject(DataService);
  private readonly requests = inject(SignalkRequestsService);

  private readonly KIP_UUID = this.settings.KipUUID;
  private readonly ACTIVE_SCREEN_PATH = `self.displays.${this.KIP_UUID}.screenIndex`;
  private readonly CHANGE_SCREEN_PATH = `self.displays.${this.KIP_UUID}.activeScreen`;

  private readonly displayName = toSignal(this.settings.getInstanceNameAsO());
  private readonly isRemoteControl = toSignal(this.settings.getIsRemoteControlAsO());
  private readonly remoteScreenPosition = toSignal(this.data.subscribePath(this.ACTIVE_SCREEN_PATH, 'default'));
  private readonly changeDashboardTo = toSignal(this.data.subscribePath(this.CHANGE_SCREEN_PATH, 'default'));
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
        console.log(`[Remote Dashboards] Sent new dashboard highlight index ${activeIdx} to server.`);
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
    this.setActiveDashboardOnRemote(this.KIP_UUID, null)
    console.log('[Remote Dashboards] Disabled: Cleared active dashboard on server');
  }

  private getScreensPayload(dashboards: Dashboard[]): IScreensPayload {
    const displayName = this.displayName();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const dashboardListItems: DashboardListItem[] = dashboards.map(({ configuration, ...rest }) => rest);
    return { displayName: displayName, screens: dashboardListItems };
  }

  private shareScreens(screens: IScreensPayload): void {
    this.setScreensOnRemote(this.KIP_UUID, screens)
    console.log('[Remote Dashboards] Sending dashboard configurations to server.');
  }

  /**
   * Publishes the current active dashboard index for a target display.
   *
   * @param kipId Target display UUID.
   * @param screenIdx Zero-based active dashboard index, or `null` to clear.
   * @returns `void`.
   *
   * @example
   * ```ts
   * remoteDashboards.setActiveDashboardOnRemote('881d9185-426e-4dc3-bb95-ed58b81392c1', 2);
   * ```
   */
  public setActiveDashboardOnRemote(kipId: string, screenIdx: number | null): void {
    const payload: IRemoteScreenCommand = { displayId: kipId, screenIdx };
    const requestId = this.requests.putRequest(this.COMMAND_SET_SCREEN_INDEX_PATH, payload, this.KIP_UUID);
    if (!requestId) {
      console.error('[Remote Dashboards] Error sharing active dashboard: request was not accepted');
    }
  }

  /**
   * Publishes dashboard catalog metadata to a target display.
   *
   * @param kipId Target display UUID.
   * @param screensPayload Remote display payload, or `null` to clear published value.
   * @returns `void`.
   *
   * @example
   * ```ts
   * remoteDashboards.setScreensOnRemote('881d9185-426e-4dc3-bb95-ed58b81392c1', {
   *   displayName: 'Helm Starboard',
   *   screens: []
   * });
   * ```
   */
  public setScreensOnRemote(kipId: string, screensPayload: IScreensPayload): void {
    const payload: IRemoteDisplayCommand = {
      displayId: kipId,
      display: screensPayload === null ? null : { ...screensPayload }
    };
    const requestId = this.requests.putRequest(this.COMMAND_SET_DISPLAY_PATH, payload, this.KIP_UUID);
    if (!requestId) {
      console.error('[Remote Dashboards] Error sharing screen configuration: request was not accepted');
    }
  }

  /**
   * Publishes a remote screen-change request command for a target display.
   *
   * @param kipId Target display UUID.
   * @param screenIdx Requested dashboard index, or `null` to clear request.
   * @returns `void`.
   *
   * @example
   * ```ts
   * remoteDashboards.clearActiveScreenOnRemote('881d9185-426e-4dc3-bb95-ed58b81392c1', 1);
   * ```
   */
  public clearActiveScreenOnRemote(kipId: string, screenIdx: number | null): void {
    const payload: IRemoteScreenCommand = { displayId: kipId, screenIdx };
    const requestId = this.requests.putRequest(this.COMMAND_REQUEST_ACTIVE_SCREEN_PATH, payload, this.KIP_UUID);
    if (!requestId) {
      console.error('[Remote Dashboards] Error clearing active screen request path: request was not accepted');
    }
  }
}
