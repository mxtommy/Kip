import { Component, inject } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'dashboards-bottom-sheet',
  imports: [ MatListModule, MatIconModule ],
  templateUrl: './dashboards-bottom-sheet.component.html',
  styleUrl: './dashboards-bottom-sheet.component.scss'
})
export class DashboardsBottomSheetComponent {
  private _bottomSheetRef =
    inject<MatBottomSheetRef<DashboardsBottomSheetComponent>>(MatBottomSheetRef);
  public data: { showCancel?: boolean } = inject<{ showCancel?: boolean }>(MAT_BOTTOM_SHEET_DATA);
  showCancel = !!(this.data && this.data.showCancel);

  clickAction(action: string) {
    this._bottomSheetRef.dismiss(action);
  }

}
