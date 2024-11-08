import { AfterViewInit, Component, ViewChild, effect, inject } from '@angular/core';
import { droppedCB, GridstackComponent, GridstackModule, NgGridStackNode, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement, GridStack } from 'gridstack';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { DashboardEditorComponent } from "../dashboard-editor/dashboard-editor.component";
import { AppService } from '../../services/app-service';
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

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardEditorComponent, DashboardScrollerComponent, DashboardScrollerComponent, DashboardEditorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit {
  @ViewChild(GridstackComponent, {static: true}) gridstack?: GridstackComponent;
  protected dashboard = inject(DashboardService);
  // TODO: remove below if not necessary
  private _app = inject(AppService);
  private previousIsStaticState: boolean = true;
  protected gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: true,
    resizable: {handles: 'all'}
  }

  //TODO: use loop to generate below and not static variables
  protected basicWidgets: NgGridStackWidget[] = [
    {selector: 'widget-numeric', w:2, h:3},
    {selector: 'widget-text', w:2, h:3},
    {selector: 'widget-datetime', w:2, h:3},
    {selector: 'widget-boolean-switch', w:2, h:3},
  ];

  protected gaugesWidgets: NgGridStackWidget[] = [
    {selector: 'widget-simple-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-linear', w:2, h:3},
    {selector: 'widget-gauge-ng-radial', w:2, h:3},
    {selector: 'widget-gauge-ng-compass', w:2, h:3},
    {selector: 'widget-gauge-steel', w:2, h:3},
  ];

  protected componentsWidgets: NgGridStackWidget[] = [
    {selector: 'widget-wind-steer', w:2, h:3},
    {selector: 'widget-freeboardsk', w:2, h:3},
    {selector: 'widget-autopilot', w:2, h:3},
    {selector: 'widget-data-chart', w:2, h:3},
    {selector: 'widget-racetimer', w:3, h:6},
    {selector: 'widget-iframe', w:2, h:3},
    {selector: 'widget-tutorial', w:2, h:3}
  ];

  protected allWidgets: NgGridStackWidget[] = [
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
    // TODO: make this more generic. Maybe from widget service
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
      this.gridstack.grid?.setStatic(isStatic);

      if (isStatic && (isStatic != this.previousIsStaticState)) {
        this.saveDashboard();
      }

      this.previousIsStaticState = isStatic;
    }, {allowSignalWrites: true});

    effect(() => {
      const widgetAction = this.dashboard.widgetAction();
      if (widgetAction) {
        this.gridstack?.grid?.getGridItems().forEach((item: GridItemHTMLElement) => {
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
    //TODO: clean up this function
    this.setupDragIn('All');
    this.resizeGridColumns();
  }

  protected setupDragIn(widgetType: string): void {
    switch (widgetType) {
      case "Basic":
        GridStack.setupDragIn('.newWidget', undefined, this.basicWidgets);
        break;
      case "Gauges":
        GridStack.setupDragIn('.newWidget', undefined, this.gaugesWidgets);
        break;
      case "Components":
        GridStack.setupDragIn('.newWidget', undefined, this.componentsWidgets);
        break;
      default:
        GridStack.setupDragIn('.newWidget', undefined, this.allWidgets);
        break;
    }
  }

  protected resizeGridColumns(): void {
    this.gridstack?.grid.cellHeight(window.innerHeight / this.gridstack?.grid.getRow());
  }

  protected loadDashboard(): void {
    const dashboard = this.dashboard.dashboards()[this.dashboard.activeDashboard()];
    this.gridstack.grid?.load(dashboard.configuration as NgGridStackWidget[]);
  }

  protected saveDashboard(): void {
    const serializedData = this.gridstack.grid?.save(false, false) as NgGridStackWidget[] || null;
    this.dashboard.updateConfiguration(this.dashboard.activeDashboard(), serializedData);
  }

  protected addWidget(dropped: droppedCB): void {
    const newNode = dropped.newNode as NgGridStackNode;
    this.deleteWidget(newNode.el);
    const ID = UUID.create();
    const widget: NgGridStackWidget = {
      w: dropped.newNode.w, h: dropped.newNode.h,
      x: dropped.newNode.x, y: dropped.newNode.y,
      id: ID,
      selector: newNode.selector,
      input: {
        widgetProperties: {
        type: newNode.selector,
        uuid: ID,
        }
      }
    };
    this.gridstack.grid.addWidget(widget);
  }

  private duplicateWidget(item: GridItemHTMLElement): void {
    const ID = UUID.create();
    const source: NgGridStackWidget = item.gridstackNode;

    this.gridstack?.grid?.addWidget({
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
    } as NgGridStackWidget);
  }

  private deleteWidget(item: GridItemHTMLElement): void {
    this.gridstack?.grid?.removeWidget(item);
  }

  protected nextDashboard(e: Event): void {
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
