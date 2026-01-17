import { ChangeDetectorRef, Component, NgZone, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ITheme } from '../../core/services/app-service';
import { IWidgetSvcConfig, IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { DashboardService } from '../../core/services/dashboard.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';
import { SvgZoneStatesComponent } from '../svg-zone-states/svg-zone-states.component';
import { INotification, NotificationsService } from '../../core/services/notifications.service';
import { toSignal } from '@angular/core/rxjs-interop';

export interface IDimensions {
  height: number,
  width: number
}

@Component({
  selector: 'widget-zones-state-panel',
  templateUrl: './widget-zones-state-panel.component.html',
  styleUrls: ['./widget-zones-state-panel.component.scss'],
  imports: [KipResizeObserverDirective, SvgZoneStatesComponent, WidgetTitleComponent]
})
export class WidgetZonesStatePanelComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Static default config consumed by runtime merge
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Zones State Panel Label',
    filterSelfPaths: true,
    // Each control uses a matching path entry by pathID. For Host2 we preserve existing shape.
    paths: [],
    enableTimeout: false,
    dataTimeout: 5,
    color: 'contrast',
    putEnable: false,
    zonesOnlyPaths: true,
    putMomentary: false,
    multiChildCtrls: []
  };

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  protected readonly runtime = inject(WidgetRuntimeDirective, { optional: true });
  private readonly notificationsService = inject(NotificationsService);
  protected readonly dashboard = inject(DashboardService);

  // Reactive state
  protected notifications = toSignal<INotification[]>(this.notificationsService.observeNotifications());
  public zonesControls = signal<IDynamicControl[]>([]);
  protected labelColor = signal<string | undefined>(undefined);
  private pathIdToNotificationPath = new Map<string, string>();
  private readonly hostSize = signal<IDimensions | null>(null);
  public readonly ctrlDimensions = computed<IDimensions>(() => {
    const size = this.hostSize();
    if (!size) return { width: 0, height: 0 };

    const nb = Math.max(1, this.zonesControls().length);
    const calcH = size.height / nb;
    const ctrlHeightProportion = (75 * size.width / 180);
    const h = Math.min(ctrlHeightProportion, calcH);

    return { width: size.width, height: h };
  });

  constructor() {
    // Effect: theme / label color
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime?.options();
      if (!theme || !cfg) return;
      untracked(() => {
        this.labelColor.set(getColors(cfg.color, theme).dim);
      });
      this.cdr.markForCheck()
    });

    // Effect: rebuild controls and paths when config changes
    effect(() => {
      const cfg = this.runtime?.options();
      if (!cfg) return;
      untracked(() => {
        const controls = (cfg.multiChildCtrls || []).map(c => ({ ...c, isNumeric: c.isNumeric ?? false }));
        this.zonesControls.set(controls);

        const pathsArr = cfg.paths as IWidgetPath[] | undefined;
        if (!pathsArr?.length) return;

        this.pathIdToNotificationPath.clear();
        for (const p of pathsArr) {
          if (!p?.pathID || !p?.path) continue;

          // Widget configs store the path under the vessel context (e.g. `self....`).
          // Notification deltas from Signal K use the notification base path (e.g. `notifications....`).
          // Normalize so controls can match incoming notification paths.
          const normalizedPath = p.path.replace(/^self(\.|$)/, 'notifications$1');
          this.pathIdToNotificationPath.set(p.pathID, normalizedPath);
        }

        // Config changed: re-apply the current notification snapshot so controls update
        // immediately (no need to wait for the next notification delta).
        this.applyNotificationsSnapshot(this.notifications());
      });
      this.cdr.markForCheck()
    });

    // Effect: update controls from notifications as they change
    effect(() => {
      const notifs = this.notifications();

      untracked(() => this.applyNotificationsSnapshot(notifs));
    });
  }

  private applyNotificationsSnapshot(notifs: INotification[] | undefined): void {
    if (!this.pathIdToNotificationPath.size || !notifs?.length) return;

    const notifByPath = new Map<string, INotification>();
    for (const n of notifs) {
      if (n?.path) notifByPath.set(n.path, n);
    }

    this.ngZone.run(() => {
      let didChange = false;

      this.zonesControls.update(list => {
        let nextList: IDynamicControl[] | null = null;

        for (let i = 0; i < list.length; i++) {
          const ctrl = list[i];
          const notificationPath = this.pathIdToNotificationPath.get(ctrl.pathID);
          const notification = notificationPath ? notifByPath.get(notificationPath) : undefined;
          if (!notification) continue;

          const state = notification.value?.['state'] as string | undefined;
          const message = notification.value?.['message'] as string | undefined;

          if (ctrl.notificationState === state && ctrl.notificationMessage === message) continue;

          if (!nextList) nextList = [...list];
          nextList[i] = {
            ...ctrl,
            notificationState: state,
            notificationMessage: message,
          };
          didChange = true;
        }

        return nextList ?? list;
      });

      if (didChange) this.cdr.markForCheck();
    });
  }

  onResized(event: ResizeObserverEntry): void {
    this.hostSize.set({ width: event.contentRect.width, height: event.contentRect.height });
    this.cdr.markForCheck();
  }
}
