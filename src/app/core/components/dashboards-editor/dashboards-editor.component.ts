import { Component, inject } from '@angular/core';
import { GestureBasicDirective } from '../../directives/gesture-basic.directive';
import { Dashboard, DashboardService } from '../../services/dashboard.service';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogService } from '../../services/dialog.service';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragMove, moveItemInArray} from '@angular/cdk/drag-drop';
import { DashboardsManageBottomSheetComponent } from '../dashboards-manage-bottom-sheet/dashboards-manage-bottom-sheet.component';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { uiEventService } from '../../services/uiEvent.service';


@Component({
  selector: 'dashboards-editor',
  standalone: true,
  imports: [ MatBottomSheetModule, MatButtonModule, PageHeaderComponent, MatIconModule, CdkDropList, CdkDrag, GestureBasicDirective ],
  templateUrl: './dashboards-editor.component.html',
  styleUrl: './dashboards-editor.component.scss'
})
export class DashboardsEditorComponent {
  protected readonly pageTitle = 'Dashboards';
  private _bottomSheet = inject(MatBottomSheet);
  protected _dashboard = inject(DashboardService);
  private _uiEvent = inject(uiEventService);
  private _dialog = inject(DialogService);

  // Drag / press coordination flags
  private _dragActive = false;       // true between dragStart and dragEnd
  private _dragMoved = false;        // becomes true once movement surpasses threshold
  private readonly _dragSuppressThresholdPx = 4; // movement to treat as a real drag

  protected addDashboard(): void {
    this._dialog.openNameDialog({
      title: 'New Dashboard',
      name: `Dashboard ${this._dashboard.dashboards().length + 1}`,
      confirmBtnText: 'Create',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) {return} //clicked cancel
      this._dashboard.add(data.name, []);
    });
  }

  protected openBottomSheet(index: number): void {
    const sheetRef = this._bottomSheet.open(DashboardsManageBottomSheetComponent);
    sheetRef.afterDismissed().subscribe((action) => {
      switch (action) {
        case 'delete':
          this.deleteDashboard(index);
          break;

        case 'duplicate':
          this.duplicateDashboard(index, `${this._dashboard.dashboards()[index].name}`);
          break;

        default:
          break;
      }
    });
  }

  protected editDashboard(itemIndex: number): void {
    this._dialog.openNameDialog({
      title: 'Rename Dashboard',
      name: this._dashboard.dashboards()[itemIndex].name,
      confirmBtnText: 'Save',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) {return} //clicked cancel
      this._dashboard.update(itemIndex, data.name);
    });
  }

  protected deleteDashboard(index: number):void {
    this._dashboard.delete(index);
  }

  protected duplicateDashboard(itemIndex: number, currentName: string): void {
    this._dialog.openNameDialog({
      title: 'Duplicate Dashboard',
      name: `${currentName} copy`,
      confirmBtnText: 'Save',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) {return} //clicked cancel
      this._dashboard.duplicate(itemIndex, data.name);
    });
  }

  protected drop(event: CdkDragDrop<Dashboard[]>): void {
    this._dashboard.dashboards.update(dashboards => {
      const updatedDashboards = [...dashboards];
      moveItemInArray(updatedDashboards, event.previousIndex, event.currentIndex);
      return updatedDashboards;
    });
  }

  protected dragStart(): void {
    this._uiEvent.isDragging.set(true);
    this._dragActive = true;
    this._dragMoved = false; // reset for new gesture
  }

  protected dragEnd(): void {
    this._uiEvent.isDragging.set(false);
    this._dragActive = false;
  // Reset movement flag shortly after drag end so future presses work.
  // Timeout lets Hammer finish any internal gesture state before we allow a new press.
  setTimeout(() => { this._dragMoved = false; }, 60);
  }

  protected onDragMoved(ev: CdkDragMove<unknown>): void {
    if (!this._dragActive || this._dragMoved) return;
    const dist = Math.hypot(ev.distance.x, ev.distance.y);
    if (dist > this._dragSuppressThresholdPx) {
      this._dragMoved = true;
    }
  }

  protected onPress(index: number): void {
    // Suppress press if an actual drag movement occurred
    if (this._dragMoved) return;
    this.openBottomSheet(index);
  }
}
