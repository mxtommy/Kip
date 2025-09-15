import { AfterViewInit, Component, DestroyRef, inject, OnDestroy, signal, viewChild, ElementRef } from '@angular/core';
import { GestureDirective } from '../../directives/gesture.directive';
import { GridstackComponent, GridstackModule, NgGridStackNode, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement } from 'gridstack';
import { DashboardService, widgetOperation } from '../../services/dashboard.service';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { UUID } from '../../utils/uuid.util';
import { AppService } from '../../services/app-service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DialogService } from '../../services/dialog.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { uiEventService } from '../../services/uiEvent.service';
import { WidgetDescription } from '../../services/widget.service';
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
import { WidgetRacerLineComponent } from '../../../widgets/widget-racer-line/widget-racer-line.component';
import { WidgetRacerTimerComponent } from '../../../widgets/widget-racer-timer/widget-racer-timer.component';
import { WidgetSimpleLinearComponent } from '../../../widgets/widget-simple-linear/widget-simple-linear.component';
import { WidgetTutorialComponent } from '../../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetWindComponent } from '../../../widgets/widget-windsteer/widget-windsteer.component';
import { WidgetLabelComponent } from '../../../widgets/widget-label/widget-label.component';
import { WidgetSliderComponent } from '../../../widgets/widget-slider/widget-slider.component';
import { ActivatedRoute, Router } from '@angular/router';
import { WidgetRacesteerComponent } from '../../../widgets/widget-racesteer/widget-racesteer.component';
import { DatasetService } from '../../services/data-set.service';
import { WidgetWindTrendsChartComponent } from '../../../widgets/widget-windtrends-chart/widget-windtrends-chart.component';
import { WidgetHorizonComponent } from '../../../widgets/widget-horizon/widget-horizon.component';
import { WidgetHeelGaugeComponent } from '../../../widgets/widget-heel-gauge/widget-heel-gauge.component';

interface PressGestureDetail { x?: number; y?: number; center?: { x: number; y: number }; }

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardScrollerComponent, MatIconModule, MatButtonModule, GestureDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  host: {
    '(document:mouseup)': 'onPointerRelease()',
    '(document:touchend)': 'onPointerRelease()'
  }
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly _app = inject(AppService);
  private readonly _dialog = inject(DialogService);
  protected readonly dashboard = inject(DashboardService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _uiEvent = inject(uiEventService);
  private readonly _dataset = inject(DatasetService);
  protected readonly _router = inject(Router);
  private readonly _hostEl = inject(ElementRef<HTMLElement>); // host element reference
  protected readonly isDashboardStatic = toSignal(this.dashboard.isDashboardStatic$, { initialValue: true });
  private readonly _gridstack = viewChild.required<GridstackComponent>('grid');
  private _previousIsStaticState = true;
  /** Suppress starting a drag sequence right after a long-press add (until pointer released) */
  private _suppressDrag = false;
  protected readonly gridOptions = signal<NgGridStackOptions>({
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: false,
    resizable: { handles: 'all' },
  });
  private _boundHandleKeyDown = this.handleKeyDown.bind(this);
  private _resizeObserver?: ResizeObserver;
  private _pendingResizeRaf: number | null = null;
  private _lastContainerHeight = 0;
  private _lastCellHeight = 0;

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
      WidgetRacerLineComponent,
      WidgetRacerTimerComponent,
      WidgetRaceTimerComponent,
      WidgetIframeComponent,
      WidgetTutorialComponent,
      WidgetWindComponent,
      WidgetRacesteerComponent,
      WidgetPositionComponent,
      WidgetLabelComponent,
      WidgetSliderComponent,
      WidgetWindTrendsChartComponent,
      WidgetHorizonComponent,
      WidgetHeelGaugeComponent
    ]);
  }

  ngAfterViewInit(): void {
    this.resizeGridColumns();
    this.setupResizeObserver();
    this._uiEvent.addHotkeyListener(
      this._boundHandleKeyDown,
      { ctrlKey: true, keys: ['arrowdown', 'arrowup'] } // Filter for arrow keys with Ctrl
    );

    // Hook Gridstack drag lifecycle early to suppress long-press during slow drags
    try {
      const grid = this._gridstack().grid as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void };
      if (grid && typeof grid.on === 'function') {
        grid.on('dragstart', () => {
          this._uiEvent.isDragging.set(true);
        });
        grid.on('dragstop', () => {
          // Slight delay ensures any pending pointerup has processed before clearing flag
          setTimeout(() => this._uiEvent.isDragging.set(false), 0);
        });
        // Also handle resize interactions
        grid.on('resizestart', () => {
          this._uiEvent.isDragging.set(true);
        });
        grid.on('resizestop', () => {
          setTimeout(() => this._uiEvent.isDragging.set(false), 0);
        });
      }
    } catch { /* ignore grid hook errors */ }

    this.dashboard.isDashboardStatic$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((isStatic) => {
      if (isStatic) {
        this._gridstack().grid.setStatic(isStatic);
        if (isStatic !== this._previousIsStaticState) {
          this.saveDashboard();
          this._previousIsStaticState = isStatic;
        }
      } else {
        this._gridstack().grid.setStatic(isStatic);
        this._previousIsStaticState = isStatic;
      }
    });

    this.dashboard.widgetAction$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((action: widgetOperation) => {
      if (action) {
        this._gridstack().grid.getGridItems().forEach((item: GridItemHTMLElement) => {
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

    this.activatedRoute.params.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(params => {
      const raw = params['id'];
      const parsed = Number(raw);
      const isValidNumber = raw !== undefined && raw !== '' && !isNaN(parsed);

      if (!isValidNumber) return; // ignore non-numeric params entirely

      if (parsed < 0 || parsed >= this.dashboard.dashboards().length) return;
      if (parsed === this.dashboard.activeDashboard()) return;

      this.dashboard.setActiveDashboard(parsed);
      this.loadDashboard(parsed);
    });
  }

  private setupResizeObserver(): void {
    if (this._resizeObserver) return;
    const host = this._hostEl.nativeElement;
    try {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._pendingResizeRaf !== null) return; // throttle to next frame
        this._pendingResizeRaf = requestAnimationFrame(() => {
          this._pendingResizeRaf = null;
          this.resizeGridColumns();
        });
      });
      this._resizeObserver.observe(host);
    } catch { /* ignore if ResizeObserver unsupported */ }
  }

  private handleKeyDown(key: string, event: KeyboardEvent): void {
    if (key === 'arrowdown') {
      this.previousDashboard(event);
    } else if (key === 'arrowup') {
      this.nextDashboard(event);
    }
  }

  protected resizeGridColumns(): void {
    try {
      const gridCmp = this._gridstack();
      const baseGrid = gridCmp.grid;
      if (!baseGrid) return;
      interface GridApi {
        getRow?: () => number;
        cellHeight?: (val: number) => void;
        batchUpdate?: () => void;
        commit?: () => void;
      }
      const grid = baseGrid as unknown as GridApi;
      const containerHeight = this._hostEl.nativeElement.clientHeight || window.innerHeight;
      if (containerHeight === this._lastContainerHeight) {
        // Host height unchanged; skip unless first run produced no cell height.
        if (this._lastCellHeight > 0) return;
      }
      const rows = grid.getRow ? grid.getRow() : 0;
      if (rows > 0 && grid.cellHeight) {
        const rowCount: number = Number(rows) || 0;
        let cellHeight = rowCount > 0 ? (containerHeight / rowCount) : 1;
        cellHeight = Math.max(1, Math.round(cellHeight * 100) / 100); // keep 2-dec precision
        if (this._lastCellHeight === cellHeight && this._lastContainerHeight === containerHeight) {
          return; // nothing changed
        }
        grid.cellHeight(cellHeight as unknown as number);
        if (grid.batchUpdate && grid.commit) {
          grid.batchUpdate();
          grid.commit();
        }
        this._lastContainerHeight = containerHeight;
        this._lastCellHeight = cellHeight;
      }
    } catch { /* swallow errors silently */ }
  }

  /**
   * Load a dashboard from configuration in batch mode
   * @param {number} dashboardId the ID of the dashboard to load
   *
   * @memberof DashboardComponent
   */
  private loadDashboard(dashboardId: number): void {
    const dashboard = this.dashboard.dashboards()[dashboardId];
    const _gridstack = this._gridstack();
    // If grid not yet ready (rare timing race), retry next microtask.
    if (!_gridstack?.grid) {
      queueMicrotask(() => this.loadDashboard(dashboardId));
      return;
    }
    // Synchronous load eliminates one-frame empty dashboard flicker.
    _gridstack.grid.batchUpdate();
    _gridstack.grid.load(dashboard.configuration as NgGridStackWidget[]);
    _gridstack.grid.commit();
  }

  protected saveDashboard(): void {
    const serializedData = this._gridstack().grid.save(false, false) as NgGridStackWidget[] || null;
    this.dashboard.updateConfiguration(this.dashboard.activeDashboard(), serializedData);
  }

  protected saveLayoutChanges(): void {
    this.dashboard.setStaticDashboard(true);
  }

  protected cancelLayoutChanges(): void {
    this.loadDashboard(this.dashboard.activeDashboard());
    this.dashboard.setStaticDashboard(true);
  }

  protected addNewWidget(e: Event | CustomEvent): void {
    if (!this.dashboard.isDashboardStatic() && (e as CustomEvent).detail !== undefined) {
      const detail = ((e as CustomEvent).detail || {}) as PressGestureDetail;
      const inputX = detail.center?.x ?? detail.x ?? 0;
      const inputY = detail.center?.y ?? detail.y ?? 0;
      const gridCell = this._gridstack().grid.getCellFromPixel({ left: inputX, top: inputY });
      const isCellEmpty = this._gridstack().grid.isAreaEmpty(gridCell.x, gridCell.y, 1, 1)

      if (isCellEmpty) {
        if (this._gridstack().grid.willItFit({ x: gridCell.x, y: gridCell.y, w: 2, h: 3 })) {
          this._dialog.openFrameDialog({
            title: 'Add Widget',
            component: 'select-widget',
          }, true).subscribe(data => {
            if (!data || typeof data !== 'object') return; //clicked cancel or invalid data
            const ID = UUID.create();
            const widget = data as WidgetDescription;

            const newWidget: NgGridStackWidget = {
              x: gridCell.x,
              y: gridCell.y,
              w: widget.defaultWidth,
              h: widget.defaultHeight,
              minW: widget.minWidth,
              minH: widget.minHeight,
              id: ID,
              selector: widget.selector,
              input: {
                widgetProperties: {
                  type: widget.selector,
                  uuid: ID,
                }
              }
            };
            this._gridstack().grid.addWidget(newWidget);
          });
        } else {
          this._app.sendSnackbarNotification('Error Adding Widget: Not enough space at the selected location. Please reorganize the dashboard to free up space or choose a larger empty area.', 0);
        }
      }
    }
  }

  /** Cancel the active pointer sequence so gridstack won't treat subsequent movement (while still holding) as a drag */
  private cancelPointerSequence(): void {
    if (this._suppressDrag) return;
    this._suppressDrag = true;
    // Temporarily set grid static so internal pointermove handlers ignore drags
    try { this._gridstack().grid.setStatic(true); } catch { /* ignore if grid not ready */ }
    ['pointerup', 'mouseup', 'touchend'].forEach(type => {
      document.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }

  protected onPointerRelease(): void {
    if (this._suppressDrag) {
      this._suppressDrag = false;
      // Restore original static (edit) state: if dashboard not static we re-enable drag
      if (!this.dashboard.isDashboardStatic()) {
        try { this._gridstack().grid.setStatic(false); } catch { /* ignore if grid not ready */ }
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

    const _gridstack = this._gridstack();
    if (_gridstack.grid.willItFit(newItem)) {
      _gridstack.grid.addWidget(newItem);
    } else {
      newItem.h = 2;
      newItem.w = 2;
      if (_gridstack.grid.willItFit(newItem)) {
        _gridstack.grid.addWidget(newItem);
      } else {
        this._app.sendSnackbarNotification('Duplication failed: Insufficient space on the dashboard. Please reorganize to free up space.', 0);
      }
    }
  }

  private deleteWidget(item: GridItemHTMLElement): void {
    const ngNode = item.gridstackNode as NgGridStackNode;

    this._gridstack().grid.removeWidget(item);

    switch (ngNode.selector) {
      case 'widget-numeric-chart':
      case 'widget-windtrends-chart': {
        // Perform any specific cleanup or actions for dataset enabled widgets
        const allDatasets = this._dataset.list() as { uuid: string }[];
        const toRemove = allDatasets?.filter(ds => ds.uuid === ngNode.id || ds.uuid?.startsWith(`${ngNode.id}-`)) || [];
        toRemove.forEach(ds => this._dataset.remove(ds.uuid));
        break;
      }
    }
  }

  protected nextDashboard(e: Event | CustomEvent): void {
    (e as Event).preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.navigateToNextDashboard();
    }
  }

  protected previousDashboard(e: Event | CustomEvent): void {
    (e as Event).preventDefault();
    if (this.dashboard.isDashboardStatic()) {
      this.dashboard.navigateToPreviousDashboard();
    }
  }

  protected editDashboard(): void {
    this.dashboard.toggleStaticDashboard();
  }

  protected navigateToHelp(): void {
    this._router.navigate(['/help']);
  }

  ngOnDestroy(): void {
    // Destroy the Gridstack instance to clean up internal resources
    const _gridstack = this._gridstack();
    if (_gridstack?.grid) {
      _gridstack.grid.destroy(true); // Ensure this cleans up event listeners and DOM elements
    }
    if (this._resizeObserver) {
      try { this._resizeObserver.disconnect(); } catch { /* ignore */ }
      this._resizeObserver = undefined;
    }
    if (this._pendingResizeRaf !== null) {
      cancelAnimationFrame(this._pendingResizeRaf);
      this._pendingResizeRaf = null;
    }
    this._uiEvent.removeHotkeyListener(this._boundHandleKeyDown);
  }
}
