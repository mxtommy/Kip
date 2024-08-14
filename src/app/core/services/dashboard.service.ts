import { AppSettingsService } from './app-settings.service';
import { effect, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import isEqual from 'lodash-es/isEqual';
import { NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';

export interface Dashboard {
  name?: string;
  configuration?: NgGridStackWidget[] | [];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  public dashboards = signal<Dashboard[]>([], {equal: isEqual});
  public activeDashboard = signal<number>(0);
  public readonly isDashboardStatic = signal<boolean>(true);
  public readonly blankDashboard: Dashboard[] = [ {name: 'Dashboard 1', configuration: []} ];

  constructor(private settings: AppSettingsService, private router: Router,) {
    const dashboards = this.settings.getDashboardConfig();
    dashboards.length == 0 ? this.dashboards.set(this.blankDashboard) : this.dashboards.set(this.settings.getDashboardConfig());

    effect(() => {
      this.settings.saveDashboards(this.dashboards());
    });
  }

  public toggleStaticDashboard(): void {
    this.isDashboardStatic.set(!this.isDashboardStatic());
  }

  public add(name: string, configuration: NgGridStackWidget[]): void {
    this.dashboards.update(dashboards =>
      [ ...dashboards, { name: name, configuration: configuration} ]
    );
  }

  public update(itemIndex: number, name: string): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, name: name } : dashboard));
  }

  public delete(itemIndex: number): void {
    this.dashboards.update(dashboards => dashboards.filter((_, i) => i !== itemIndex)
    );
  }

  public duplicate(itemIndex: number, newName: string): void {
    const sourceDashboard = this.dashboards()[itemIndex];
    this.dashboards.update(dashboards =>
      [ ...dashboards, {
        name: newName,
        configuration: sourceDashboard.configuration
      }
      ]
    );
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
}
