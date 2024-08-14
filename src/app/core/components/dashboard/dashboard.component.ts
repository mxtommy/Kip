import { Component, ViewChild, effect } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { DashboardService } from '../../services/dashboard.service';
import { ActivatedRoute } from '@angular/router';
import { WidgetNumericComponent } from '../../../widgets/widget-numeric/widget-numeric.component';
import { WidgetService } from '../../services/widget.service';
import { GridHTMLElement } from 'gridstack';

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [ GridstackModule ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  @ViewChild(GridstackComponent, {static: true}) gridstack?: GridstackComponent;
  protected gridOptions: NgGridStackOptions = {
    margin: 5,
    minRow: 12, // don't let it collapse when empty
    maxRow: 12,
    // cellHeight: "auto",
    // cellHeight: "59.90",
    // cellHeightUnit: "%",
    float: true,

  }
  protected widgets: NgGridStackWidget[] = [
    { x: 0, y: 0, minW: 2, id: '7298b3be-232f-48bf-9b3d-3b445131a908', selector: 'widget-numeric' },
    { x: 2, y: 1, id: 'widget2', content: 'Item 2 sdfg sd fg sdf gs dfg' },
    { x: 2, y: 2, id: 'widget3', content: 'Item 3 sdf g sdfg sd fg' },
  ];

  private previousIsStaticState: boolean = true;

  constructor(
    protected dashboard: DashboardService,
    private _widget: WidgetService,
    private route: ActivatedRoute
  ) {
    // TODO: make this more generic. Maybe from widget service
    GridstackComponent.addComponentToSelectorType([WidgetNumericComponent]);
    effect(() => {
      this.loadDashboard();
    });

    effect(() => {
      const isStatic = this.dashboard.isDashboardStatic();
      this.gridstack.grid?.setStatic(isStatic);

      if (isStatic && (isStatic != this.previousIsStaticState)) {
        this.saveDashboard();
      }

      this.previousIsStaticState = isStatic;
    }, {allowSignalWrites: true});
  }

  protected loadDashboard(): void {
    const dashboard = this.dashboard.dashboards()[this.dashboard.activeDashboard()];
    this.gridstack.grid?.load(dashboard.configuration as NgGridStackWidget[]);
  }

  protected saveDashboard(): void {
    const serializedData = this.gridstack.grid?.save(false, false) as NgGridStackWidget[] || null;
    this.dashboard.updateConfiguration(this.dashboard.activeDashboard(), serializedData);
  }

  protected resizeGridColumns(e: Event): void {
    const gridRect = this.gridstack?.grid.el.getBoundingClientRect();
    const cellHeight = gridRect.height / this.gridstack?.grid.getRow();
    this.gridstack?.grid.cellHeight(cellHeight, true);
    console.log(cellHeight);
  }

  protected onSwipeUp(e: Event): void {
    e.preventDefault();
    this.dashboard.previousDashboard();
  }

  protected onSwipeDown(e: Event): void {
    e.preventDefault();
    this.dashboard.nextDashboard();
  }
}
