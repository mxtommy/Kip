import { Component, inject } from '@angular/core';
import { Dashboard, DashboardService } from '../../services/dashboard.service';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogService } from '../../services/dialog.service';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DashboardsManageBottomSheetComponent } from '../dashboards-manage-bottom-sheet/dashboards-manage-bottom-sheet.component';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';


@Component({
  selector: 'dashboards-manage',
  standalone: true,
  imports: [ MatBottomSheetModule, MatButtonModule, PageHeaderComponent, MatIconModule, CdkDropList, CdkDrag, CdkDragHandle ],
  templateUrl: './dashboards-manage.component.html',
  styleUrl: './dashboards-manage.component.scss'
})
export class DashboardsManageComponent {
  protected readonly pageTitle = 'Dashboards';
  private _bottomSheet = inject(MatBottomSheet);
  protected _dashboard = inject(DashboardService);
  private _dialog = inject(DialogService);

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

        case 'rename':
          this.renameDashboard(index, this._dashboard.dashboards()[index].name);
          break;

        default:
          break;
      }
    });
  }

  protected renameDashboard(itemIndex: number, currentName: string, ): void {
    this._dialog.openNameDialog({
      title: 'Rename Dashboard',
      name: currentName,
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
}
