import { Component, inject, signal } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { WidgetDescription, WidgetService } from '../../services/widget.service';
import { WidgetListCardComponent } from '../widget-list-card/widget-list-card.component';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'widgets-list',
  standalone: true,
  imports: [MatButtonToggleModule, WidgetListCardComponent],
  templateUrl: './widgets-list.component.html',
  styleUrl: './widgets-list.component.scss'
})
export class WidgetsListComponent {
  private dialogRef = inject<MatDialogRef<WidgetsListComponent>>(MatDialogRef);

  protected _widgets = inject(WidgetService);
  protected widgetsList: WidgetDescription[] = [];
  protected _widgetCategory = signal<string>("Basic");

  constructor() {
    this.widgetsList = this._widgets.kipWidgets.filter((widget) => widget.category === this._widgetCategory());
  }

  protected onCategoryChange(category: MatButtonToggleChange): void {
    this.widgetsList = this._widgets.kipWidgets.filter((widget) => widget.category === category.value);
    this._widgetCategory.set(category.value);
  }

  protected onSelectWidget(widgetSelector: string): void {
    this.dialogRef.close(widgetSelector);
  }
}
