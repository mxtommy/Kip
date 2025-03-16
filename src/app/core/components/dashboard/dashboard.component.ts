import { AfterViewInit, Component, effect, inject, viewChild } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement, GridStack } from 'gridstack';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { DashboardEditorComponent } from "../dashboard-editor/dashboard-editor.component";
import { UUID } from '../../utils/uuid';

import { WidgetTextComponent } from '../../../widgets/widget-text/widget-text.component';
import { WidgetNumericComponent } from '../../../widgets/widget-numeric/widget-numeric.component';
import { WidgetDatetimeComponent } from '../../../widgets/widget-datetime/widget-datetime.component';
import { WidgetBooleanSwitchComponent } from '../../../widgets/widget-boolean-switch/widget-boolean-switch.component';
import { WidgetAutopilotComponent } from '../../../widgets/widget-autopilot/widget-autopilot.component';
import { WidgetDataChartComponent } from '../../../widgets/widget-data-chart/widget-data-chart.component';
import { WidgetFreeboardskComponent } from '../../../widgets/widget-freeboardsk/widget-freeboardsk.component';
import { WidgetGaugeNgCompassComponent } from '../../../widgets/widget-gauge-ng-compass/widget-gauge-ng-compass.component';
import { WidgetGaugeNgLinearComponent } from '../../../widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent } from '../../../widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { WidgetSteelGaugeComponent } from '../../../widgets/widget-gauge-steel/widget-gauge-steel.component';
import { WidgetIframeComponent } from '../../../widgets/widget-iframe/widget-iframe.component';
import { WidgetRaceTimerComponent } from '../../../widgets/widget-race-timer/widget-race-timer.component';
import { WidgetSimpleLinearComponent } from '../../../widgets/widget-simple-linear/widget-simple-linear.component';
import { WidgetTutorialComponent } from '../../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetWindComponent } from '../../../widgets/widget-wind/widget-wind.component';
import { AppService } from '../../services/app-service';

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardEditorComponent, DashboardScrollerComponent, DashboardScrollerComponent, DashboardEditorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit {
  private _app = inject(AppService);
  protected dashboard = inject(DashboardService);
  private _gridstack = viewChild.required(GridstackComponent);
  private _previousIsStaticState: boolean = true;
  protected gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: true,
    resizable: {handles: 'all'}
  }
  private basicWidgets: NgGridStackWidget[] = [
    {selector: 'widget-numeric', w:2, h:3},
    {selector: 'widget-text', w:2, h:3},
    {selector: 'widget-datetime', w:2, h:3},
    {selector: 'widget-boolean-switch', w:2, h:3},
  ];
  private gaugesWidgets: NgGridStackWidget[] = [
    {selector: 'widget-simple-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-radial', w:2, h:3},
    {selector: 'widget-gauge-ng-compass', w:2, h:3},
    {selector: 'widget-gauge-steel', w:2, h:3},
  ];
  private componentsWidgets: NgGridStackWidget[] = [
    {selector: 'widget-wind-steer', w:2, h:3},
    {selector: 'widget-freeboardsk', w:6, h:8},
    {selector: 'widget-autopilot', w:4, h:9},
    {selector: 'widget-data-chart', w:2, h:3},
    {selector: 'widget-racetimer', w:3, h:6},
    {selector: 'widget-iframe', w:2, h:3},
    {selector: 'widget-tutorial', w:2, h:3}
  ];
  private allWidgets: NgGridStackWidget[] = [
    {selector: 'widget-numeric', w:2, h:3},
    {selector: 'widget-text', w:2, h:3},
    {selector: 'widget-datetime', w:2, h:3},
    {selector: 'widget-boolean-switch', w:2, h:3},
    {selector: 'widget-simple-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-radial', w:2, h:3},
    {selector: 'widget-gauge-ng-compass', w:2, h:3},
    {selector: 'widget-gauge-steel', w:2, h:3},
    {selector: 'widget-wind-steer', w:2, h:3},
    {selector: 'widget-freeboardsk', w:2, h:3},
    {selector: 'widget-autopilot', w:2, h:3},
    {selector: 'widget-data-chart', w:2, h:3},
    {selector: 'widget-racetimer', w:3, h:6},
    {selector: 'widget-iframe', w:2, h:3},
    {selector: 'widget-tutorial', w:2, h:3}
  ];

  constructor() {
    GridstackComponent.addComponentToSelectorType([
      WidgetNumericComponent,
      WidgetTextComponent,
      WidgetDatetimeComponent,
      WidgetBooleanSwitchComponent,
      WidgetSimpleLinearComponent,
      WidgetGaugeNgLinearComponent,
      WidgetGaugeNgRadialComponent,
      WidgetGaugeNgCompassComponent,
      WidgetSteelGaugeComponent,
      WidgetFreeboardskComponent,
      WidgetAutopilotComponent,
      WidgetDataChartComponent,
      WidgetRaceTimerComponent,
      WidgetIframeComponent,
      WidgetTutorialComponent,
      WidgetWindComponent
    ]);

    effect(() => {
      this.loadDashboard();
    });

    effect(() => {
      const isStatic = this.dashboard.isDashboardStatic();
      this._gridstack().grid.setStatic(isStatic);

      if (isStatic && (isStatic != this._previousIsStaticState)) {
        this.saveDashboard();
      }

      this._previousIsStaticState = isStatic;
    }, {allowSignalWrites: true});

    effect(() => {
      const widgetAction = this.dashboard.widgetAction();
      if (widgetAction) {
        this._gridstack().grid.getGridItems().forEach((item: GridItemHTMLElement) => {
          if (item.gridstackNode.id === widgetAction.id) {
            switch (widgetAction.operation) {
              case 'delete':
                this.deleteWidget(item);
                break;
              case 'duplicate':
                this.duplicateWidget(item);
                break;
              default:
                break;
            }
          }
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.resizeGridColumns();
  }

  protected setupDragIn(widgetType: string): void {
    switch (widgetType) {
      case "Basic":
        GridStack.setupDragIn('.newWidget', {helper: this.makeWidget}, this.basicWidgets);
        break;
      case "Gauges":
        GridStack.setupDragIn('.newWidget', {helper: this.makeWidget}, this.gaugesWidgets);
        break;
      case "Components":
        GridStack.setupDragIn('.newWidget', {helper: this.makeWidget}, this.componentsWidgets);
        break;
      default:
        GridStack.setupDragIn('.newWidget', {helper: this.makeWidget}, this.allWidgets);
        break;
    }
  }

  protected resizeGridColumns(): void {
    this._gridstack().grid.cellHeight(window.innerHeight / this._gridstack().grid.getRow());
  }

  protected loadDashboard(): void {
    const dashboard = this.dashboard.dashboards()[this.dashboard.activeDashboard()];
    this._gridstack().grid.load(dashboard.configuration as NgGridStackWidget[]);
  }

  protected saveDashboard(): void {
    const serializedData = this._gridstack().grid.save(false, false) as NgGridStackWidget[] || null;
    this.dashboard.updateConfiguration(this.dashboard.activeDashboard(), serializedData);
  }

  protected makeWidget(draggedItem: GridItemHTMLElement): GridItemHTMLElement {
    const clone = draggedItem.cloneNode(true);
    const opt = draggedItem.gridstackNode as NgGridStackWidget;

    opt.id = UUID.create();
    opt.input = {
      ...opt.input,
      widgetProperties: {
        ...opt.input?.widgetProperties,
        type: opt.selector,
        uuid: opt.id
      }
    };

    (clone as GridItemHTMLElement).gridstackNode = opt;
    return clone as GridItemHTMLElement;
  }

  private duplicateWidget(item: GridItemHTMLElement): void {
    const ID = UUID.create();
    const source: NgGridStackWidget = item.gridstackNode;
    const newItem = {
      w: source.w, h: source.h,
      id: ID,
      selector: source.selector,
      input: {
        widgetProperties: {
          type: source.input.widgetProperties.type,
          uuid: ID,
          config: source.input.widgetProperties.config
        }
      }
    } as NgGridStackWidget;

    if(this._gridstack().grid.willItFit(newItem)) {
      this._gridstack().grid.addWidget(newItem);
    } else {
      newItem.h = 2;
      newItem.w = 2;
      if(this._gridstack().grid.willItFit(newItem)) {
        this._gridstack().grid.addWidget(newItem);
      } else {
       this._app.sendSnackbarNotification('Duplication failed: Insufficient space on the dashboard. Please reorganize to free up space.', 0);
      }
    }
  }

  private deleteWidget(item: GridItemHTMLElement): void {
    this._gridstack().grid.removeWidget(item);
  }

  protected nextDashboard(e: any): void {
    e.preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.previousDashboard();
    }
  }

  protected previousDashboard(e: Event): void {
    e.preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.nextDashboard();
    }
  }
}
