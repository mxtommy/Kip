import { AfterViewInit, Component, effect, inject, OnDestroy, viewChild } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement } from 'gridstack';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { UUID } from '../../utils/uuid';
import { AppService } from '../../services/app-service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DialogService } from '../../services/dialog.service';
import { NotificationBadgeComponent } from "../notification-badge/notification-badge.component";
import { NotificationsService } from '../../services/notifications.service';
import { toSignal } from '@angular/core/rxjs-interop';
import cloneDeep from 'lodash-es/cloneDeep';

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
import { WidgetPositionComponent } from '../../../widgets/widget-position/widget-position.component';
import { WidgetRaceTimerComponent } from '../../../widgets/widget-race-timer/widget-race-timer.component';
import { WidgetSimpleLinearComponent } from '../../../widgets/widget-simple-linear/widget-simple-linear.component';
import { WidgetTutorialComponent } from '../../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetWindComponent } from '../../../widgets/widget-wind/widget-wind.component';


@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardScrollerComponent, DashboardScrollerComponent, MatIconModule, MatButtonModule, NotificationBadgeComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit, OnDestroy{
  private _app = inject(AppService);
  private _dialog = inject(DialogService);
  protected dashboard = inject(DashboardService);
  private _notifications = inject(NotificationsService);
  protected notificationsInfo = toSignal(this._notifications.observerNotificationsInfo());
  private _gridstack = viewChild.required(GridstackComponent);
  private _previousIsStaticState: boolean = true;
  protected gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: false,
    resizable: {handles: 'all'
    }
  }

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
      WidgetWindComponent,
      WidgetPositionComponent,
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
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        this.previousDashboard(event);
        break;
      case 'ArrowDown':
        this.nextDashboard(event);
        break;
      default:
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

  protected saveLayoutChanges(): void {
    this.dashboard.isDashboardStatic.set(true);
  }

  protected cancelLayoutChanges(): void {
    this.loadDashboard();
    this.dashboard.isDashboardStatic.set(true);
  }

  protected addNewWidget(e: any): void {
    if (!this.dashboard.isDashboardStatic()) {
      const inputX = (e as HammerInput).center.x;
      const inputY = (e as HammerInput).center.y;
      const gridCell = this._gridstack().grid.getCellFromPixel({left: inputX, top: inputY});
      const isCellEmpty = this._gridstack().grid.isAreaEmpty(gridCell.x, gridCell.y, 1, 1)

      if (isCellEmpty) {
        if (this._gridstack().grid.willItFit({x: gridCell.x, y: gridCell.y, w: 2, h: 3})) {
          this._dialog.openFrameDialog({
            title: 'Add Widget',
            component: 'select-widget',
          }, true).subscribe(data => {
            if (!data) {return} //clicked cancel
            const ID = UUID.create();
            const newWidget: NgGridStackWidget = {
              x: gridCell.x,
              y: gridCell.y,
              w: 2,
              h: 3,
              id: ID,
              // @ts-ignore
              selector: data,
              input: {
                widgetProperties: {
                  type: data,
                  uuid: ID,
                }
              }
            };
            this._gridstack().grid.addWidget(newWidget);
          });
        } else {
          this._app.sendSnackbarNotification('Add Widget Error: Not enough space at the selected location. Please reorganize the dashboard to free up space or choose a larger empty area.', 0);
        }
      }
    }
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
          config: cloneDeep(source.input.widgetProperties.config)
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
