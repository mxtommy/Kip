import { AfterViewInit, Component, ViewChild, effect, inject } from '@angular/core';
import { GridstackComponent, GridstackModule, NgGridStackOptions, NgGridStackWidget } from 'gridstack/dist/angular';
import { GridItemHTMLElement, GridStack } from 'gridstack';
import { DashboardService } from '../../services/dashboard.service';
import { UUID } from '../../utils/uuid';

import { WidgetTextComponent } from '../../../widgets/widget-text/widget-text.component';
import { WidgetNumericComponent } from '../../../widgets/widget-numeric/widget-numeric.component';
import { WidgetDatetimeComponent } from '../../../widgets/widget-datetime/widget-datetime.component';
import { WidgetBooleanSwitchComponent } from '../../../widgets/widget-boolean-switch/widget-boolean-switch.component';
import { DashboardScrollerComponent } from "../dashboard-scroller/dashboard-scroller.component";
import { DashboardEditorComponent } from "../dashboard-editor/dashboard-editor.component";

@Component({
  selector: 'dashboard',
  standalone: true,
  imports: [GridstackModule, DashboardEditorComponent, DashboardScrollerComponent, DashboardScrollerComponent, DashboardEditorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit {
  @ViewChild(GridstackComponent, {static: true}) gridstack?: GridstackComponent;
  protected gridOptions: NgGridStackOptions = {
    margin: 4,
    minRow: 12,
    maxRow: 12,
    float: true,
    acceptWidgets: true
  }
  protected dashboard = inject(DashboardService);
  private previousIsStaticState: boolean = true;

  constructor() {
    // TODO: make this more generic. Maybe from widget service
    GridstackComponent.addComponentToSelectorType([
      WidgetNumericComponent,
      WidgetTextComponent,
      WidgetDatetimeComponent,
      WidgetBooleanSwitchComponent,
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
    GridStack.setupDragIn('.sidebar', { appendTo: 'body', helper: this.createWidget});
    this.resizeGridColumns();
  }

  private createWidget = (e): any => {
    const ID = UUID.create();
    const el = e.target.cloneNode(true);
    const ngEl = this.gridstack?.grid?.addWidget({
      w: 2, h: 2,
      id: ID,
      selector: 'widget-numeric',
      input: {
        widgetProperties: {
        type: 'widget-numeric',
        uuid: ID,
        }
      }
    } as NgGridStackWidget);

    const mergedEl = Object.assign(el, ngEl);
    return mergedEl;
    // return el
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
    this.gridstack?.grid?.addWidget({
      x: 0, y: 0, w: 2, h: 2,
      id: ID,
      selector: selector,
      input: {
        widgetProperties: {
        type: selector,
        uuid: ID,
        }
      }
    } as NgGridStackWidget);
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
