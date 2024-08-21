import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'dashboards-manage-bottom-sheet',
  standalone: true,
  imports: [ MatListModule, MatIconModule ],
  templateUrl: './dashboards-manage-bottom-sheet.component.html',
  styleUrl: './dashboards-manage-bottom-sheet.component.scss'
})
export class DashboardsManageBottomSheetComponent {
  private _bottomSheetRef =
    inject<MatBottomSheetRef<DashboardsManageBottomSheetComponent>>(MatBottomSheetRef);

  clickAction(action: string) {
    this._bottomSheetRef.dismiss(action);
  }

}
