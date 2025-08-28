import { AppSettingsService } from './app-settings.service';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import isEqual from 'lodash-es/isEqual';
import cloneDeep from 'lodash-es/cloneDeep';
import { UUID } from '../utils/uuid.util';
import { BehaviorSubject } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

export interface Dashboard {
  id: string
  name?: string;
  icon?: string;
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
  private _settings = inject(AppSettingsService);
  private _router = inject(Router);
  public dashboards = signal<Dashboard[]>([], {equal: isEqual});
  public readonly activeDashboard = signal<number>(0);
  private _widgetAction = new BehaviorSubject<widgetOperation>(null);
  public widgetAction$ = this._widgetAction.asObservable();
  private _isDashboardStatic = new BehaviorSubject<boolean>(true);
  public isDashboardStatic$ = this._isDashboardStatic.asObservable();
  public readonly isDashboardStatic = toSignal(this.isDashboardStatic$);
  public readonly blankDashboard: Dashboard[] = [ {id: null, name: 'Dashboard 1', icon: 'dashboard', configuration: [
    {
      "w": 12,
      "h": 12,
      "id": "d1d58e6f-f8b4-4a72-9597-7f92aa6776fc",
      "selector": "widget-tutorial",
      "input": {
        "widgetProperties": {
          "type": "widget-tutorial",
          "uuid": "d1d58e6f-f8b4-4a72-9597-7f92aa6776fc"
        }
      },
      "x": 0,
      "y": 0
    }
  ]} ];

  constructor() {
    const dashboards = this._settings.getDashboardConfig();

    if (!dashboards || dashboards.length === 0) {
      console.warn('[Dashboard Service] No dashboards found in settings, creating blank dashboard');
      const newBlankDashboard = this.blankDashboard.map(dashboard => ({
          ...dashboard,
          id: UUID.create()
      }));
      this.dashboards.set([...newBlankDashboard]);
    } else {
      this.dashboards.set(this._settings.getDashboardConfig());
    }

    effect(() => {
      this._settings.saveDashboards(this.dashboards());
    });
  }

  /**
   * Toggles the static/fixed state of the dashboard layout.
   */
  public toggleStaticDashboard(): void {
    this._isDashboardStatic.next(!this._isDashboardStatic.value);
  }

  /**
   * Adds a new dashboard with the given name, widget configuration, and optional icon.
   * @param name The name of the new dashboard.
   * @param configuration The widget configuration array.
   * @param icon The optional icon for the dashboard.
   */
  public add(name: string, configuration: NgGridStackWidget[], icon?: string): void {
    this.dashboards.update(dashboards =>
      [ ...dashboards, {id: UUID.create(), name: name, icon: icon, configuration: configuration} ]
    );
  }

  /**
   * Updates the name and icon of a dashboard at the specified index.
   * @param itemIndex The index of the dashboard to update.
   * @param name The new name for the dashboard.
   * @param icon The new icon for the dashboard (defaults to "dashboard").
   */
  public update(itemIndex: number, name: string, icon = "dashboard"): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, name: name, icon: icon } : dashboard));
  }

  /**
   * Deletes the dashboard at the specified index.
   * If no dashboards remain, creates a new blank dashboard.
   * @param itemIndex The index of the dashboard to delete.
   */
  public delete(itemIndex: number): void {
    this.dashboards.update(dashboards => dashboards.filter((_, i) => i !== itemIndex));

    if (this.dashboards().length === 0) {
      this.add( 'Dashboard ' + (this.dashboards().length + 1), []);
      this.activeDashboard.set(0);
    } else if (this.activeDashboard() > this.dashboards().length - 1) {
      this.activeDashboard.set(this.dashboards().length - 1);
    }
  }

  /**
   * Duplicates the dashboard at the specified index with a new name and optional icon.
   * All widget and dashboard IDs are regenerated.
   * @param itemIndex The index of the dashboard to duplicate.
   * @param newName The name for the duplicated dashboard.
   * @param newIcon The optional icon for the duplicated dashboard.
   */
  public duplicate(itemIndex: number, newName: string, newIcon?: string): void {
    if (itemIndex < 0 || itemIndex >= this.dashboards().length) {
        console.error(`[Dashboard Service] Invalid itemIndex: ${itemIndex}`);
        return;
    }

    const originalDashboard = this.dashboards()[itemIndex];
    const newDashboard = cloneDeep(originalDashboard);

    newDashboard.id = UUID.create();
    newDashboard.name = newName;
    newDashboard.icon = newIcon || originalDashboard.icon || 'dashboard';

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

    this.dashboards.update(dashboards => [
        ...dashboards,
        newDashboard
    ]);
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
    this._widgetAction.next({id: id, operation: 'delete'});
  }

  /**
   * Emits a widget duplicate operation for the widget with the given ID.
   * @param id The widget ID to duplicate.
   */
  public duplicateWidget(id: string): void {
    this._widgetAction.next({id: id, operation: 'duplicate'});
  }

  /**
   * Sets the static/fixed state of the dashboard layout.
   * @param isStatic Whether the dashboard should be static.
   */
  public setStaticDashboard(isStatic: boolean): void {
    this._isDashboardStatic.next(isStatic);
  }
}
