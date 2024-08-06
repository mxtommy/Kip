import { AppSettingsService } from './app-settings.service';
import { effect, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import isEqual from 'lodash-es/isEqual';
import { NgGridStackOptions } from 'gridstack/dist/angular';

export interface Dashboard {
  name?: string;
  configuration?: NgGridStackOptions | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  public dashboards = signal<Dashboard[]>([], {equal: isEqual});
  public readonly activeDashboard = signal<number>(0);

  constructor(private settings: AppSettingsService, private router: Router,) {
    this.dashboards.set(this.settings.getDashboardConfig());

    effect(() => {
      this.settings.saveDashboards(this.dashboards());
    });
  }

  public add(name: string, configuration?: NgGridStackOptions): void {
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

  public updateConfiguration(itemIndex: number, configuration: NgGridStackOptions): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex ? { ...dashboard, configuration: configuration } : dashboard));
  }

  public navigateNext(): void {
    if ((this.activeDashboard() + 1) > (this.dashboards().length) - 1) {
      this.activeDashboard.set(0);
    } else {
      this.activeDashboard.set(this.activeDashboard() + 1);
    }
    this.router.navigate(['/dashboard', this.activeDashboard()]);
  }

  public navigatePrevious(): void {
    if ((this.activeDashboard() - 1) < 0) {
      this.activeDashboard.set(this.dashboards().length - 1);
    } else {
      this.activeDashboard.set(this.activeDashboard() - 1);
    }
    this.router.navigate(['/dashboard', this.activeDashboard()]);
  }

  public navigateToActive(): void {
    this.router.navigate(['/dashboard', this.activeDashboard()]);
  }

  public navigateTo(index: number): void {
    this.activeDashboard.set(index);
    this.router.navigate(['/dashboard', this.activeDashboard()]);
  }
}
