import { LargeIconTileComponent } from './../large-icon-tile/large-icon-tile.component';
import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DashboardService } from '../../services/dashboard.service';
import { WidgetService } from '../../services/widget.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

@Component({
  selector: 'dashboard-editor',
  standalone: true,
  imports: [ MatListModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatButtonToggleModule, LargeIconTileComponent],
  templateUrl: './dashboard-editor.component.html',
  styleUrl: './dashboard-editor.component.scss'
})
export class DashboardEditorComponent {
  protected onNewWidget = output<string>();
  protected dashboard = inject(DashboardService);
  protected widget = inject(WidgetService);

  constructor() {
  }

  protected saveLayout() {
    this.dashboard.isDashboardStatic.set(true);
  }

  protected newWidget(selector: string): void {
    this.onNewWidget.emit(selector);
  }
}
