import { ControlType } from './../interfaces/widgets-interface';
import { AppSettingsService } from './app-settings.service';
import { effect, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import isEqual from 'lodash-es/isEqual';
import { ISplitSet } from './layout-splits.service';

export interface Dashboard {
  name: string;
  description: string | null;
  layoutConfiguration: Array<ISplitSet> | null;
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

  public add(name: string, description?: string, configuration?: any): void {
    this.dashboards.update(dashboards =>
      [ ...dashboards, {
        name: name,
        description: description,
        layoutConfiguration: configuration}
      ]
    );
  }

  public update(itemIndex: number, name?: string, description?: string, configuration?: any): void {
    this.dashboards.update(dashboards => dashboards.map((dashboard, i) =>
      i === itemIndex
        ? { name: name, description: description, layoutConfiguration: configuration }
        : dashboard
    ));
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
        description: sourceDashboard.description,
        layoutConfiguration: sourceDashboard.layoutConfiguration
      }
      ]
    );
  }

  public navigateNext(): void {
    if ((this.activeDashboard() + 1) > (this.dashboards().length) - 1) {
      this.activeDashboard.set(0);
    } else {
      this.activeDashboard.set(this.activeDashboard() + 1);
    }
    this.router.navigate(['/page', this.activeDashboard()]);
  }

  public navigatePrevious(): void {
    if ((this.activeDashboard() - 1) < (this.dashboards().length) - 1) {
      this.activeDashboard.set(this.dashboards().length - 1);
    } else {
      this.activeDashboard.set(this.activeDashboard() - 1);
    }
    this.router.navigate(['/page', this.activeDashboard()]);
  }

  public navigateToActive(): void {
    this.router.navigate(['/page', this.activeDashboard()]);
  }

  public navigateTo(index: number): void {
    this.activeDashboard.set(index);
    this.router.navigate(['/page', this.activeDashboard()]);
  }
}
