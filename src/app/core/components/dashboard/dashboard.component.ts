import { AfterViewInit, Component, DestroyRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement } from 'gridstack';
import { DashboardService, widgetOperation } from '../../services/dashboard.service';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { UUID } from '../../utils/uuid.util';
import { AppService } from '../../services/app-service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DialogService } from '../../services/dialog.service';
import { NotificationBadgeComponent } from "../notification-badge/notification-badge.component";
import { NotificationsService } from '../../services/notifications.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { uiEventService } from '../../services/uiEvent.service';
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
import { WidgetLabelComponent } from '../../../widgets/widget-label/widget-label.component';
import { WidgetSliderComponent } from '../../../widgets/widget-slider/widget-slider.component';


@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardScrollerComponent, MatIconModule, MatButtonModule, NotificationBadgeComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit, OnDestroy{
  private readonly _app = inject(AppService);
  private readonly _dialog = inject(DialogService);
  protected readonly dashboard = inject(DashboardService);
  private readonly _notifications = inject(NotificationsService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _uiEvent = inject(uiEventService);
  protected readonly notificationsInfo = toSignal(this._notifications.observerNotificationsInfo());
  protected readonly isDashboardStatic = toSignal(this.dashboard.isDashboardStatic$);
  protected isLoading = signal(true);
  @ViewChild('grid', { static: true }) private _gridstack!: GridstackComponent;
  private _previousIsStaticState = true;
  protected readonly gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: false,
    resizable: {handles: 'all'},
  }
  private _boundHandleKeyDown = this.handleKeyDown.bind(this);

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
      WidgetLabelComponent,
      WidgetSliderComponent
    ]);
  }

  ngAfterViewInit(): void {
    this.dashboard.isDashboardStatic$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((isStatic) => {
      if (isStatic) {
        this._gridstack.grid.setStatic(isStatic);
        if (isStatic !== this._previousIsStaticState) {
          this.saveDashboard();
          this._previousIsStaticState = isStatic;
        }
      } else {
        this._gridstack.grid.setStatic(isStatic);
        this._previousIsStaticState = isStatic;
      }
    });

    this.dashboard.widgetAction$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((action: widgetOperation) => {
      if (action) {
        this._gridstack.grid.getGridItems().forEach((item: GridItemHTMLElement) => {
          if (item.gridstackNode.id === action.id) {
            switch (action.operation) {
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

    this.resizeGridColumns();
    this._uiEvent.addHotkeyListener(
      this._boundHandleKeyDown,
      { ctrlKey: true, keys: ['arrowdown', 'arrowup'] } // Filter for arrow keys with Ctrl
    );

    setTimeout(() => {
      this.loadDashboard(this.dashboard.activeDashboard());
      // Ensure loading is set to false after GridStack is fully ready
      this.isLoading.set(false);
    });
  }

  ngOnDestroy(): void {
    // Destroy the Gridstack instance to clean up internal resources
    if (this._gridstack?.grid) {
      this._gridstack.grid.destroy(true); // Ensure this cleans up event listeners and DOM elements
    }
    // Remove the reference to the GridstackComponent
    this._gridstack = null;

    this._uiEvent.removeHotkeyListener(this._boundHandleKeyDown);
  }

  private handleKeyDown(key: string, event: KeyboardEvent): void {
    if (key === 'arrowdown') {
      this.previousDashboard(event);
    } else if (key === 'arrowup') {
      this.nextDashboard(event);
    }
  }

  protected resizeGridColumns(): void {
    this._gridstack.grid.cellHeight(window.innerHeight / this._gridstack.grid.getRow());
  }

  /**
   * Load a dashboard from configuration in batch mode
   * @protected
   * @param {number} dashboardId the ID of the dashboard to load
   *
   * @memberof DashboardComponent
   */
  protected loadDashboard(dashboardId: number): void {
    const dashboard = this.dashboard.dashboards()[dashboardId];
    if (this._gridstack?.grid) {
      this._gridstack.grid.batchUpdate();
      this._gridstack.grid.load(dashboard.configuration as NgGridStackWidget[]);
      this._gridstack.grid.commit();
      this.isLoading.set(false);
    }
  }

  protected saveDashboard(): void {
    const serializedData = this._gridstack.grid.save(false, false) as NgGridStackWidget[] || null;
    this.dashboard.updateConfiguration(this.dashboard.activeDashboard(), serializedData);
  }

  protected saveLayoutChanges(): void {
    this.dashboard.setStaticDashboard(true);
  }

  protected cancelLayoutChanges(): void {
    this.loadDashboard(this.dashboard.activeDashboard());
    this.dashboard.setStaticDashboard(true);
  }

  protected addNewWidget(e: unknown): void {
    if (!this.dashboard.isDashboardStatic()) {
      const inputX = (e as HammerInput).center.x;
      const inputY = (e as HammerInput).center.y;
      const gridCell = this._gridstack.grid.getCellFromPixel({left: inputX, top: inputY});
      const isCellEmpty = this._gridstack.grid.isAreaEmpty(gridCell.x, gridCell.y, 1, 1)

      if (isCellEmpty) {
        if (this._gridstack.grid.willItFit({x: gridCell.x, y: gridCell.y, w: 2, h: 3})) {
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
              // @ts-expect-error TBD
              selector: data,
              input: {
                widgetProperties: {
                  type: data,
                  uuid: ID,
                }
              }
            };
            this._gridstack.grid.addWidget(newWidget);
          });
        } else {
          this._app.sendSnackbarNotification('Error Adding Widget: Not enough space at the selected location. Please reorganize the dashboard to free up space or choose a larger empty area.', 0);
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

    if(this._gridstack.grid.willItFit(newItem)) {
      this._gridstack.grid.addWidget(newItem);
    } else {
      newItem.h = 2;
      newItem.w = 2;
      if(this._gridstack.grid.willItFit(newItem)) {
        this._gridstack.grid.addWidget(newItem);
      } else {
       this._app.sendSnackbarNotification('Duplication failed: Insufficient space on the dashboard. Please reorganize to free up space.', 0);
      }
    }
  }

  private deleteWidget(item: GridItemHTMLElement): void {
    this._gridstack.grid.removeWidget(item);
  }

  protected nextDashboard(e: Event): void {
    e.preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.nextDashboard();
      if (this._gridstack?.grid) {
        setTimeout(() => {
          this.loadDashboard(this.dashboard.activeDashboard());
        }, 0);
      }
    }
  }

  protected previousDashboard(e: Event): void {
    e.preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.previousDashboard();
      if (this._gridstack?.grid) {
        setTimeout(() => {
          this.loadDashboard(this.dashboard.activeDashboard());
        }, 0);
      }
    }
  }

  protected editDashboard(): void {
    this.dashboard.toggleStaticDashboard();
  }
}
