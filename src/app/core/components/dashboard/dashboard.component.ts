import { AfterViewInit, Component, ViewChild, effect, inject } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
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
  private _app = inject(AppService);
  protected gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: true,
    resizable: {handles: 'all'}
  }
  private previousIsStaticState: boolean = true;

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
    GridStack.setupDragIn('.sidebar', { helper: this.createWidget});

    this.resizeGridColumns();
  }

  //TODO: clean up this function
  private createWidget = (event): any => {
    const widget: GridItemHTMLElement = event.target;

    const ID = UUID.create();
    widget.gridstackNode = {
      w: 2, h: 2,
      id: ID,
      selector: 'widget-numeric',
      input: {
        widgetProperties: {
        type: 'widget-numeric',
        uuid: ID,
        }
      }
    } as NgGridStackWidget;
    return widget;
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

  public addWidget(selector: string): void {
    const ID = UUID.create();
    const widget = {
      autoPosition: true,
      w: 2, h: 2,
      id: ID,
      selector: selector,
      input: {
        widgetProperties: {
        type: selector,
        uuid: ID,
        }
      }
    } as NgGridStackWidget;

    if (this.gridstack.grid.willItFit(widget)){
      this.gridstack.grid.addWidget(widget);
    } else {
      this._app.sendSnackbarNotification('This dashboard has no available space left to add more widgets. Resize your existing widgets and leave free space to add more widgets', 0, false);
    }
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
