import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'dashboard-clipboard-bottom-sheet',
  imports: [MatListModule, MatIconModule],
  templateUrl: './dashboard-clipboard-bottom-sheet.component.html',
  styleUrl: './dashboard-clipboard-bottom-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardClipboardBottomSheetComponent {
  private _bottomSheetRef =
    inject<MatBottomSheetRef<DashboardClipboardBottomSheetComponent>>(MatBottomSheetRef);

  clickAction(action: 'paste' | 'clear' | 'add') {
    this._bottomSheetRef.dismiss(action);
  }
}
