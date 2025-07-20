import { Component, inject, signal, OnInit } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { WidgetDescriptionWithPluginStatus, WidgetService, WidgetDescription } from '../../services/widget.service';
import { WidgetListCardComponent } from '../widget-list-card/widget-list-card.component';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'widgets-list',
  standalone: true,
  imports: [MatButtonToggleModule, WidgetListCardComponent],
  templateUrl: './widgets-list.component.html',
  styleUrl: './widgets-list.component.scss'
})
export class WidgetsListComponent implements OnInit {
  private _dialogRef = inject<MatDialogRef<WidgetsListComponent>>(MatDialogRef);
  protected _widgets = inject(WidgetService);
  private _widgetsList: WidgetDescriptionWithPluginStatus[] = [];
  protected filteredWidgetsList = signal<WidgetDescriptionWithPluginStatus[]>([]);
  protected _widgetCategory = signal<string>("Basic");
  protected isDependencyValid = signal<boolean>(true);

  ngOnInit(): void {
    this.loadWidgets();
  }

  private async loadWidgets(): Promise<void> {
    this._widgetsList = await this._widgets.getKipWidgetsWithStatus();
    this.filteredWidgetsList.set(this._widgetsList.filter(widget => widget.category === this._widgetCategory()));
  }

  protected onCategoryChange(category: MatButtonToggleChange): void {
    this.filteredWidgetsList.set(this._widgetsList.filter(widget => widget.category === category.value));
    this._widgetCategory.set(category.value);
  }

  protected onSelectWidget(selectedWidget: WidgetDescriptionWithPluginStatus): void {
    const {
      name,
      description,
      icon,
      minWidth,
      minHeight,
      defaultWidth,
      defaultHeight,
      category,
      pluginDependency,
      selector,
      componentClassName
    } = selectedWidget;

    const widget: WidgetDescription = {
      name,
      description,
      icon,
      minWidth,
      minHeight,
      defaultWidth,
      defaultHeight,
      category,
      pluginDependency,
      selector,
      componentClassName
    };
    this._dialogRef.close(widget);
  }
}
