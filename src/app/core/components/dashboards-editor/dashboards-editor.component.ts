import { Component, HostListener, inject } from '@angular/core';
import { GestureDirective } from '../../directives/gesture.directive';
import { Dashboard, DashboardService } from '../../services/dashboard.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogService } from '../../services/dialog.service';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragMove, moveItemInArray } from '@angular/cdk/drag-drop';
import { DashboardsManageBottomSheetComponent } from '../dashboards-manage-bottom-sheet/dashboards-manage-bottom-sheet.component';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { uiEventService } from '../../services/uiEvent.service';
import { MatRippleModule } from '@angular/material/core';
import { DomSanitizer } from '@angular/platform-browser';


@Component({
  selector: 'dashboards-editor',
  imports: [MatBottomSheetModule, MatButtonModule, MatIconModule, CdkDropList, CdkDrag, MatRippleModule, GestureDirective],
  templateUrl: './dashboards-editor.component.html',
  styleUrl: './dashboards-editor.component.scss'
})
export class DashboardsEditorComponent {
  protected readonly pageTitle = 'Dashboards';
  private _bottomSheet = inject(MatBottomSheet);
  protected _dashboard = inject(DashboardService);
  private _uiEvent = inject(uiEventService);
  private _dialog = inject(DialogService);
  private _sanitizer = inject(DomSanitizer);
  /** True while bottom sheet open */
  protected _sheetOpen = false;
  /** Suppress starting a drag after a press consumed the pointer */
  protected suppressDrag = false;

  // Drag / press coordination flags
  private _dragActive = false;       // true between dragStart and dragEnd
  private _dragMoved = false;        // becomes true once movement surpasses threshold
  private readonly _dragSuppressThresholdPx = 4; // movement to treat as a real drag

  protected addDashboard(): void {
    this._dialog.openDashboardPageEditorDialog({
      title: 'New Dashboard',
      name: `Dashboard ${this._dashboard.dashboards().length + 1}`,
      icon: 'dashboard',
      confirmBtnText: 'Create',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) { return } //clicked cancel
      this._dashboard.add(data.name, [], data.icon);
    });
  }

  protected openBottomSheet(index: number): void {
    // Detect Linux Firefox for workaround
    const isLinuxFirefox = typeof navigator !== 'undefined' &&
      /Linux/.test(navigator.platform) &&
      /Firefox/.test(navigator.userAgent);
    const sheetRef = this._bottomSheet.open(DashboardsManageBottomSheetComponent, isLinuxFirefox ? { disableClose: true, data: { showCancel: true } } : {});
    sheetRef.afterDismissed().subscribe((action) => {
      this._sheetOpen = false;
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
    const dashboard = this._dashboard.dashboards()[itemIndex];
    this._dialog.openDashboardPageEditorDialog({
      title: 'Dashboard Details',
      name: dashboard.name,
      icon: dashboard.icon || 'dashboard',
      confirmBtnText: 'Save',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) { return } //clicked cancel
      this._dashboard.update(itemIndex, data.name, data.icon);
    });
  }

  protected deleteDashboard(index: number): void {
    this._dashboard.delete(index);
  }

  protected duplicateDashboard(itemIndex: number, currentName: string): void {
    const originalDashboard = this._dashboard.dashboards()[itemIndex];
    this._dialog.openDashboardPageEditorDialog({
      title: 'Duplicate Dashboard',
      name: `${currentName} copy`,
      icon: originalDashboard.icon || 'dashboard',
      confirmBtnText: 'Save',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) { return } //clicked cancel
      this._dashboard.duplicate(itemIndex, data.name, data.icon);
    });
  }

  protected drop(event: CdkDragDrop<Dashboard[]>): void {
    this._dashboard.dashboards.update(dashboards => {
      const updatedDashboards = [...dashboards];
      moveItemInArray(updatedDashboards, event.previousIndex, event.currentIndex);

      // Update active dashboard index if it was affected by the move
      const currentActive = this._dashboard.activeDashboard();
      if (currentActive === event.previousIndex) {
        // Active item was moved to new position
        this._dashboard.activeDashboard.set(event.currentIndex);
      } else if (currentActive > event.previousIndex && currentActive <= event.currentIndex) {
        // Active item shifted down due to move
        this._dashboard.activeDashboard.set(currentActive - 1);
      } else if (currentActive < event.previousIndex && currentActive >= event.currentIndex) {
        // Active item shifted up due to move
        this._dashboard.activeDashboard.set(currentActive + 1);
      }
      return updatedDashboards;
    });
  }

  protected dragStart(): void {
    if (this._sheetOpen || this.suppressDrag) return; // block drag while sheet open or suppressed
    this._uiEvent.isDragging.set(true);
    this._dragActive = true;
    this._dragMoved = false; // reset for new gesture
  }

  protected dragEnd(): void {
    this._uiEvent.isDragging.set(false);
    this._dragActive = false;
    // Reset movement flag shortly after drag end so future presses work.
    // Timeout lets finish any internal gesture state before we allow a new press.
    setTimeout(() => { this._dragMoved = false; }, 60);
  }

  protected onDragMoved(ev: CdkDragMove<unknown>): void {
    if (!this._dragActive || this._dragMoved) return;
    const dist = Math.hypot(ev.distance.x, ev.distance.y);
    if (dist > this._dragSuppressThresholdPx) {
      this._dragMoved = true;
    }
  }

  protected onPress(index: number, e: Event | CustomEvent): void {
    (e as Event).preventDefault();
    (e as Event).stopPropagation();
    // Suppress press if an actual drag movement occurred
    if (this._dragMoved) return;
    // Cancel pointer sequence so moving while holding does not initiate drag
    this.cancelPointerSequence();
    this.openBottomSheet(index);
  }

  private cancelPointerSequence(): void {
    this.suppressDrag = true;
    this._dragActive = false;
    this._dragMoved = false;
    // Dispatch synthetic pointer end events to end any potential drag tracking
    ['pointerup', 'mouseup', 'touchend'].forEach(type => {
      document.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  private _onPointerRelease(): void {
    // Allow future drags after actual release, but only if sheet not open
    if (!this._sheetOpen) {
      this.suppressDrag = false;
    }
  }
}
