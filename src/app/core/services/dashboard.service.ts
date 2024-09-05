import { AppSettingsService } from './app-settings.service';
import { effect, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import isEqual from 'lodash-es/isEqual';
import { UUID } from '../utils/uuid';

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
  public dashboards = signal<Dashboard[]>([], {equal: isEqual});
  public activeDashboard = signal<number>(0);
  public widgetAction = signal<widgetOperation>(null);
  public readonly isDashboardStatic = signal<boolean>(true);
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

  constructor(private settings: AppSettingsService, private router: Router,) {
    const dashboards = this.settings.getDashboardConfig();

    if (dashboards.length === 0) {
      const newBlankDashboard = this.blankDashboard.map(dashboard => ({
          ...dashboard,
          id: UUID.create()
      }));
      this.dashboards.set([...newBlankDashboard]);
    } else {
      this.dashboards.set(this.settings.getDashboardConfig());
    }

    effect(() => {
      this.settings.saveDashboards(this.dashboards());
    });
  }

  public toggleStaticDashboard(): void {
    this.isDashboardStatic.set(!this.isDashboardStatic());
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
    const sourceDashboard = this.dashboards()[itemIndex];
    const newConfiguration = sourceDashboard.configuration.map(item => ({
      ...item,
      id: UUID.create()
    }));

    this.dashboards.update(dashboards => [
      ...dashboards,
      {
        id: UUID.create(),
        name: newName,
        configuration: newConfiguration
      }
    ]);
  }

  public updateConfiguration(itemIndex: number, configuration: NgGridStackWidget[]): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, configuration: configuration } : dashboard));
  }

  public nextDashboard(): void {
    if ((this.activeDashboard() + 1) > (this.dashboards().length) - 1) {
      this.activeDashboard.set(0);
    } else {
      this.activeDashboard.set(this.activeDashboard() + 1);
    }
  }

  public previousDashboard(): void {
    if ((this.activeDashboard() - 1) < 0) {
      this.activeDashboard.set(this.dashboards().length - 1);
    } else {
      this.activeDashboard.set(this.activeDashboard() - 1);
    }
  }

  public navigateToActive(): void {
    this.router.navigate(['/dashboard', this.activeDashboard()]);
  }

  public navigateTo(index: number): void {
    if (index < 0 || index > this.dashboards().length - 1) {
      return;
    }
    this.router.navigate(['/dashboard', index]);
  }

  public deleteWidget(id: string): void {
    this.widgetAction.set({id: id, operation: 'delete'});
  }

  public duplicateWidget(id: string): void {
    this.widgetAction.set({id: id, operation: 'duplicate'});
  }
}
