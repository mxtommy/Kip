import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'widget-host-bottom-sheet',
  standalone: true,
  imports: [ MatListModule, MatIconModule],
  templateUrl: './widget-host-bottom-sheet.component.html',
  styleUrl: './widget-host-bottom-sheet.component.scss'
})
export class WidgetHostBottomSheetComponent {
  private _bottomSheetRef =
    inject<MatBottomSheetRef<WidgetHostBottomSheetComponent>>(MatBottomSheetRef);

  clickAction(action: string) {
    this._bottomSheetRef.dismiss(action);
  }
}
