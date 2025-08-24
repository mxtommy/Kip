import { Component, inject, input, model } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GestureDirective } from '../../directives/gesture.directive';
import { DialogService } from '../../services/dialog.service';
import { IWidgetSvcConfig } from '../../interfaces/widgets-interface';
import { DashboardService } from '../../services/dashboard.service';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { WidgetHostBottomSheetComponent } from '../widget-host-bottom-sheet/widget-host-bottom-sheet.component';

@Component({
  selector: 'widget-host',
  standalone: true,
  imports: [ MatCardModule, MatBottomSheetModule, GestureDirective ],
  templateUrl: './widget-host.component.html',
  styleUrl: './widget-host.component.scss'
})
export class WidgetHostComponent {
  protected config = model.required<IWidgetSvcConfig>();
  protected id = input.required<string>();
  private _dialog = inject(DialogService);
  protected _dashboard = inject(DashboardService);
  private _bottomSheet = inject(MatBottomSheet);

  constructor() {
  }

  public openWidgetOptions(): void {
    if (!this._dashboard.isDashboardStatic()) {
      // Prevent opening Options Dialogue if the widget has no config property
      if (!this.config()) return;
      this._dialog.openWidgetOptions({
        title: 'Widget Options',
        config: this.config(),
        confirmBtnText: 'Save',
        cancelBtnText: 'Cancel'
      }).afterClosed().subscribe(result => {
        if (result) {
          this.config.set(result);
        }
      });
    }
  }

  public openBottomSheet(): void {
    if (!this._dashboard.isDashboardStatic()) {
      const sheetRef = this._bottomSheet.open(WidgetHostBottomSheetComponent);
      sheetRef.afterDismissed().subscribe((action) => {
        switch (action) {
          case 'delete':
            this._dashboard.deleteWidget(this.id());
            break;

          case 'duplicate':
            this._dashboard.duplicateWidget(this.id());
            break;

          default:
            break;
        }
      });
    }
  }
}
