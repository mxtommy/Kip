import { AppSettingsService } from './app-settings.service';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import isEqual from 'lodash-es/isEqual';
import cloneDeep from 'lodash-es/cloneDeep';
import { UUID } from '../utils/uuid.util';
import { DefaultDashboard } from '../../../default-config/config.blank.dashboard';
import { BehaviorSubject } from 'rxjs';

export interface Dashboard {
  id: string
  name?: string;
  icon?: string;
  collapseSplitShell?: boolean;
  configuration?: NgGridStackWidget[] | [];
}

export interface widgetOperation {
  id: string;
  operation: 'delete' | 'duplicate';
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly _settings = inject(AppSettingsService);
  private readonly _router = inject(Router);
  public dashboards = signal<Dashboard[]>([], { equal: isEqual });
  public readonly activeDashboard = signal<number>(0);
  private _widgetAction = new BehaviorSubject<widgetOperation>(null);
  public widgetAction$ = this._widgetAction.asObservable();
  public isDashboardStatic = signal<boolean>(true);

  public readonly layoutEditSaved = signal<number>(0);
  public readonly layoutEditCanceled = signal<number>(0);

  constructor() {
    const dashboards = this._settings.getDashboardConfig();

    if (!dashboards || dashboards.length === 0) {
      console.warn('[Dashboard Service] No dashboards found in settings, creating blank dashboard');
      const newBlankDashboard = DefaultDashboard.map(dashboard => ({
        ...dashboard,
        id: UUID.create()
      }));
      this.dashboards.set([...newBlankDashboard]);
    } else {
      this.dashboards.set(this._settings.getDashboardConfig());
    }

    effect(() => {
      const dashboards = this.dashboards();
      this._settings.saveDashboards(dashboards);
    });
  }

  /**
   * Toggles the static/fixed state of the dashboard layout.
   */
  public toggleStaticDashboard(): void {
    this.isDashboardStatic.set(!this.isDashboardStatic());
  }

  /**
   * Adds a new dashboard.
   *
   * Behavior:
   * - Generates a new UUID for the dashboard.
   * - If no icon provided, defaults to 'dashboard-dashboard'.
   * - collapseSplitShell flag (optional) controls forced Freeboard Shell panel collapse
   *   when global Freeboard Shell Mode is enabled:
   *     true  => In split view the Freeboard panel is locked collapsed (user cannot expand/resize).
   *     false/undefined => Normal persisted panel behavior.
   * - The flag does not overwrite previously persisted user width/collapse preferences;
   *   it only enforces collapse while true.
   *
   * @param name  Display name of the dashboard.
   * @param configuration Initial Gridstack widget configuration (empty array for blank).
   * @param icon Optional icon key (defaults to 'dashboard-dashboard').
   * @param collapseSplitShell Optional per-dashboard forced shell collapse flag (defaults to false).
   * @returns Index (0-based) of the newly inserted dashboard.
   */
  public add(name: string, configuration: NgGridStackWidget[], icon?: string, collapseSplitShell?: boolean): number {
    let newIndex = 0;
    this.dashboards.update(dashboards => {
      const updated = [...dashboards, { id: UUID.create(), name, icon: icon ?? 'dashboard-dashboard', configuration, collapseSplitShell: collapseSplitShell ?? false }];
      newIndex = updated.length - 1;
      return updated;
    });
    return newIndex;
  }

  /**
   * Updates dashboard metadata at the specified index.
   *
   * Mutates only lightweight descriptive fields (name, icon) plus the
   * per‑dashboard Freeboard Shell collapse flag. It does NOT:
   *  - change the dashboard id
   *  - alter the widget configuration array
   *
   * collapseSplitShell semantics:
   *  - true  => When global Freeboard Shell Mode is enabled the Freeboard panel
   *            is forced collapsed & locked for this dashboard (no expand/resize).
   *  - false => Normal persisted panel behavior (user can expand/resize if allowed).
   *
   * @param itemIndex Index of the dashboard to update (0-based).
   * @param name New display name.
   * @param icon New icon key (fallback to 'dashboard-dashboard').
   * @param collapseSplitShell Per-dashboard forced collapse flag.
   */
  public update(itemIndex: number, name: string, icon: string, collapseSplitShell: boolean): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, name: name, icon: icon ?? 'dashboard-dashboard', collapseSplitShell: collapseSplitShell ?? false } : dashboard));
  }

  /**
   * Deletes the dashboard at the specified index.
   * If no dashboards remain, creates a new blank dashboard.
   * @param itemIndex The index of the dashboard to delete.
   */
  public delete(itemIndex: number): void {
    this.dashboards.update(dashboards => dashboards.filter((_, i) => i !== itemIndex));

    if (this.dashboards().length === 0) {
      this.add('Dashboard ' + (this.dashboards().length + 1), []);
      this.activeDashboard.set(0);
    } else if (this.activeDashboard() > this.dashboards().length - 1) {
      this.activeDashboard.set(this.dashboards().length - 1);
    }
  }

  /**
   * Duplicates an existing dashboard (deep clone) and appends it to the dashboards list.
   *
   * Behavior:
   * - Deep clones the source dashboard (including its widget configuration).
   * - Generates a new UUID for the duplicated dashboard itself.
   * - Generates a new UUID for every widget AND updates each widget's
   *   input.widgetProperties.uuid to keep internal references consistent.
   * - Name and icon are replaced with the provided values (icon defaults to 'dashboard-dashboard' if empty).
   * - collapseSplitShell flag explicitly set from the provided parameter (falls back to false if undefined),
   *   rather than inheriting the original value silently. Caller decides whether to retain or change it.
   *
   * Safety / Validation:
   * - Returns -1 and logs an error if itemIndex is out of bounds.
   * - If the original configuration is not an array, logs an error and replaces with [] in the duplicate.
   * - Logs an error if any widget lacks the expected input.widgetProperties structure.
   *
   * Freeboard Shell Flag Semantics (collapseSplitShell):
   * - true  => When global Freeboard Shell Mode is enabled, the Freeboard panel is forced collapsed & locked
   *            (no expand/resize) for the duplicated dashboard.
   * - false => Normal persisted panel behavior (user may expand/resize when allowed).
   *
   * @param itemIndex             Index of the dashboard to duplicate (0-based).
   * @param newName               Display name for the duplicated dashboard.
   * @param newIcon               Optional icon key (defaults to 'dashboard-dashboard' if falsy).
   * @param collapseSplitShell Per-dashboard forced Freeboard panel collapse flag for the duplicate.
   * @returns                     The new dashboard's index, or -1 on failure.
   */
  public duplicate(itemIndex: number, newName: string, newIcon: string, collapseSplitShell: boolean): number {
    if (itemIndex < 0 || itemIndex >= this.dashboards().length) {
      console.error(`[Dashboard Service] Invalid itemIndex: ${itemIndex}`);
      return -1;
    }

    const originalDashboard = this.dashboards()[itemIndex];
    const newDashboard = cloneDeep(originalDashboard);

    newDashboard.id = UUID.create();
    newDashboard.name = newName;
    newDashboard.icon = newIcon || 'dashboard-dashboard';
    newDashboard.collapseSplitShell = collapseSplitShell ?? false;

    if (Array.isArray(newDashboard.configuration)) {
      newDashboard.configuration.forEach((widget: NgGridStackWidget) => {
        if (widget && widget.input?.widgetProperties) {
          widget.id = UUID.create();
          widget.input.widgetProperties.uuid = widget.id;
        } else {
          console.error("Dashboard Service] Widget configuration is missing required properties:", widget);
        }
      });
    } else {
      console.error("Dashboard Service] Dashboard configuration is not an array:", newDashboard.configuration);
      newDashboard.configuration = [];
    }

    let newIndex = -1;
    this.dashboards.update(dashboards => {
      const updated = [...dashboards, newDashboard];
      newIndex = updated.length - 1;
      return updated;
    });
    return newIndex;
  }

  /**
   * Updates the widget configuration for the dashboard at the specified index.
   * Only updates if the configuration has changed.
   * @param itemIndex The index of the dashboard to update.
   * @param configuration The new widget configuration array.
   */
  public updateConfiguration(itemIndex: number, configuration: NgGridStackWidget[]): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) => {
      if (i === itemIndex) {
        // Only update if the configuration has changed
        if (isEqual(dashboard.configuration, configuration)) {
          return dashboard; // No changes, return the same reference
        }
        return { ...dashboard, configuration: configuration }; // Update with new configuration
      }
      return dashboard; // No changes for other dashboards
    }));
  }

  /**
   * Switches to the previous dashboard in the list.
   * Wraps to the last dashboard if at the beginning.
   * This only updates the internal state and does NOT trigger navigation or URL changes.
   */
  public previousDashboard(): void {
    if ((this.activeDashboard() + 1) > (this.dashboards().length) - 1) {
      this.activeDashboard.set(0);
    } else {
      this.activeDashboard.set(this.activeDashboard() + 1);
    }
  }

  /**
   * Switches to the next dashboard in the list.
   * Wraps to the first dashboard if at the end.
   * This only updates the internal state and does NOT trigger navigation or URL changes.
   */
  public nextDashboard(): void {
    if ((this.activeDashboard() - 1) < 0) {
      this.activeDashboard.set(this.dashboards().length - 1);
    } else {
      this.activeDashboard.set(this.activeDashboard() - 1);
    }
  }

  /**
   * Sets the active dashboard index in the service.
   * This only updates the internal state and does NOT trigger navigation or URL changes.
   * @param itemIndex The index of the dashboard to activate.
   */
  public setActiveDashboard(itemIndex: number): void {
    if (itemIndex === this.activeDashboard()) return;
    // No change if the same dashboard is selected to prevent unnecessary cascading updates

    if (itemIndex >= 0 && itemIndex < this.dashboards().length) {
      this.activeDashboard.set(itemIndex);
    } else {
      console.error(`[Dashboard Service] Invalid dashboard ID: ${itemIndex}`);
    }
  }

  /**
   * Navigates the router to the currently active dashboard.
   * This updates the browser URL and triggers Angular routing.
   */
  public navigateToActive(): void {
    this._router.navigate(['/dashboard', this.activeDashboard()]);
  }

  /**
   * Navigates the router to the dashboard at the specified index.
   * This updates the browser URL and triggers Angular routing.
   * @param itemIndex The index of the dashboard to navigate to.
   */
  public navigateTo(itemIndex: number): void {
    if (itemIndex >= 0 && itemIndex < this.dashboards().length) {
      this._router.navigate(['/dashboard', itemIndex]);
    } else {
      console.error(`[Dashboard Service] Invalid dashboard ID: ${itemIndex}`);
    }
  }

  /**
   * Navigates to the next dashboard in the list.
   * If the current dashboard is the first one, wraps around to the last dashboard.
   * This updates the browser URL and triggers Angular routing.
   */
  public navigateToNextDashboard(): void {
    let nextDashboard: number = null;
    if ((this.activeDashboard() - 1) < 0) {
      nextDashboard = this.dashboards().length - 1;
    } else {
      nextDashboard = this.activeDashboard() - 1;
    }
    this._router.navigate(['/dashboard', nextDashboard]);
  }

  /**
   * Navigates to the previous dashboard in the list.
   * If the current dashboard is the last one, wraps around to the first dashboard.
   * This updates the browser URL and triggers Angular routing.
   */
  public navigateToPreviousDashboard(): void {
    let nextDashboard: number = null;
    if ((this.activeDashboard() + 1) >= this.dashboards().length) {
      nextDashboard = 0;
    } else {
      nextDashboard = this.activeDashboard() + 1;
    }
    this._router.navigate(['/dashboard', nextDashboard]);
  }

  /**
   * Emits a widget delete operation for the widget with the given ID.
   * @param id The widget ID to delete.
   */
  public deleteWidget(id: string): void {
    this._widgetAction.next({ id: id, operation: 'delete' });
  }

  /**
   * Emits a widget duplicate operation for the widget with the given ID.
   * @param id The widget ID to duplicate.
   */
  public duplicateWidget(id: string): void {
    this._widgetAction.next({ id: id, operation: 'duplicate' });
  }

  /**
   * Sets the static/fixed state of the dashboard layout.
   * @param isStatic Whether the dashboard should be static.
   */
  public setStaticDashboard(isStatic: boolean): void {
    this.isDashboardStatic.set(isStatic);
  }

  public notifyLayoutEditSaved(): void {
     this.layoutEditSaved.update(v => v + 1);
   }

  public notifyLayoutEditCanceled(): void {
    this.layoutEditCanceled.update(v => v + 1);
  }
}
