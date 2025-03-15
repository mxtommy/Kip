import { AfterViewInit, Component, inject, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetDescription, WidgetService } from '../../services/widget.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import { TileWidgetDragComponent } from '../tile-widget-drag/tile-widget-drag.component';

@Component({
  selector: 'dashboard-editor',
  standalone: true,
  imports: [ MatListModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatButtonToggleModule, TileWidgetDragComponent],
  templateUrl: './dashboard-editor.component.html',
  styleUrl: './dashboard-editor.component.scss'
})
export class DashboardEditorComponent implements AfterViewInit {
  protected OnChangeWidgetCategory = output<string>();
  protected dashboard = inject(DashboardService);
  protected widget = inject(WidgetService);
  protected widgets: WidgetDescription[] = [];
  private _widgetCategory = signal<string>("Basic");

  constructor() {
    this.widgets = this.widget.kipWidgets.filter((widget) => widget.category === this._widgetCategory());
  }

  ngAfterViewInit() {
    this.OnChangeWidgetCategory.emit(this._widgetCategory());
  }

  protected saveLayout() {
    this.dashboard.isDashboardStatic.set(true);
  }

  protected widgetCategoryChange(category: string): void {
    this.widgets = this.widget.kipWidgets.filter((widget) => widget.category === category);
    this._widgetCategory.set(category);
    // Must use setTimeout to ensure the event is emitted only after the widgetCategory is set
    // else the event will be emitted before the DOM is fully loaded and GridStack.setupDragIn()
    // will fail
    setTimeout(() => {
      this.OnChangeWidgetCategory.emit(this._widgetCategory()), 500
    });
  }
}
