import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { DashboardService } from '../../services/dashboard.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs/internal/Subscription';

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [ GridstackModule ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(GridstackComponent, {static: true}) gridstack?: GridstackComponent;
  protected gridOptions: NgGridStackOptions = {
    margin: 5,
    minRow: 1, // don't let it collapse when empty
    cellHeight: 80,
    float: true
  }
  private routeSubscription: Subscription;
  protected widgets: NgGridStackWidget[] = [
    { x: 0, y: 0, minW: 2, id: 'widget1', content: 'Item 1 sdgfsdfgs dfg sdfg sd fg sd fg sd fg sd fg sdfg' },
    { x: 2, y: 1, id: 'widget2', content: 'Item 2 sdfg sd fg sdf gs dfg' },
    { x: 2, y: 2, id: 'widget3', content: 'Item 3 sdf g sdfg sd fg' },
  ];

  constructor(private _dashboard: DashboardService, private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe(params => {
      this._dashboard.navigateTo(+params['id']);
      this.loadDashboard();
    })
  }

  protected loadDashboard(): void {
    const dashboard = this._dashboard.dashboards()[this._dashboard.activeDashboard()];
    this.gridstack.grid?.load(dashboard.configuration as NgGridStackWidget[]);
  }

  protected saveDashboard(): void {
    const serializedData = this.gridstack.grid?.save(false, false, () => {
      console.log('TODO Save callback to get widget config into the grid widget data structure');
    }) as NgGridStackOptions || null;
    this._dashboard.updateConfiguration(this._dashboard.activeDashboard(), serializedData);
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }
}
