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
  public readonly blankDashboard: Dashboard[] = [ {id: null, name: 'Dashboard 1', configuration: [
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

  public toggleStaticDashboard(): void {
    this._isDashboardStatic.next(!this._isDashboardStatic.value);
  }

  public add(name: string, configuration: NgGridStackWidget[]): void {
    this.dashboards.update(dashboards =>
      [ ...dashboards, {id: UUID.create(), name: name, configuration: configuration} ]
    );
  }

  public update(itemIndex: number, name: string): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, name: name } : dashboard));
  }

  public delete(itemIndex: number): void {
    this.dashboards.update(dashboards => dashboards.filter((_, i) => i !== itemIndex));

    if (this.dashboards().length === 0) {
      this.add( 'Dashboard ' + (this.dashboards().length + 1), []);
      this.activeDashboard.set(0);
    } else if (this.activeDashboard() > this.dashboards().length - 1) {
      this.activeDashboard.set(this.dashboards().length - 1);
    }
  }

  public duplicate(itemIndex: number, newName: string): void {
    if (itemIndex < 0 || itemIndex >= this.dashboards().length) {
        console.error(`[Dashboard Service] Invalid itemIndex: ${itemIndex}`);
        return;
    }

    const originalDashboard = this.dashboards()[itemIndex];
    const newDashboard = cloneDeep(originalDashboard);

    newDashboard.id = UUID.create();
    newDashboard.name = newName;

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

  public previousDashboard(): void {
    if ((this.activeDashboard() + 1) > (this.dashboards().length) - 1) {
      this.activeDashboard.set(0);
    } else {
      this.activeDashboard.set(this.activeDashboard() + 1);
    }
  }

  public nextDashboard(): void {
    if ((this.activeDashboard() - 1) < 0) {
      this.activeDashboard.set(this.dashboards().length - 1);
    } else {
      this.activeDashboard.set(this.activeDashboard() - 1);
    }
  }

  public setActiveDashboard(itemIndex: number): void {
    if (itemIndex >= 0 && itemIndex < this.dashboards().length) {
      this.activeDashboard.set(itemIndex);
    }
  }

  public navigateToActive(): void {
    this._router.navigate(['/dashboard', this.activeDashboard()]);
  }

  public navigateTo(index: number): void {
    if (index < 0 || index > this.dashboards().length - 1) {
      return;
    }
    this._router.navigate(['/dashboard', index]);
  }

  public deleteWidget(id: string): void {
    this._widgetAction.next({id: id, operation: 'delete'});
  }

  public duplicateWidget(id: string): void {
    this._widgetAction.next({id: id, operation: 'duplicate'});
  }

  public setStaticDashboard(isStatic: boolean): void {
    this._isDashboardStatic.next(isStatic);
  }
}
