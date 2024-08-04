import { Component } from '@angular/core';
import { Dashboard, DashboardService } from '../../services/dashboard.service';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogService } from '../../services/dialog.service';
import { MatMenuModule } from '@angular/material/menu';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray, CdkDragHandle } from '@angular/cdk/drag-drop';


@Component({
  selector: 'dashboard-pages',
  standalone: true,
  imports: [ MatButtonModule, PageHeaderComponent, MatIconModule, MatMenuModule, CdkDropList, CdkDrag, CdkDragHandle ],
  templateUrl: './dashboard-pages.component.html',
  styleUrl: './dashboard-pages.component.scss'
})
export class DashboardPagesComponent {
  protected readonly pageTitle = 'Dashboards';

  constructor(protected _dashboard: DashboardService, private dialog: DialogService) {
  }

  protected addDashboard(): void {
    this.dialog.openNameDialog({
      title: 'New Dashboard',
      name: `Dashboard-${this._dashboard.dashboards().length + 1}`,
      confirmBtnText: 'Create',
      cancelBtnText: 'Cancel'
    }).afterClosed().subscribe(data => {
      if (!data) {return} //clicked cancel
      this._dashboard.add(data.name);
    });
  }

  protected renameDashboard(currentName: string, itemIndex: number): void {
    this.dialog.openNameDialog({
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
    this.dialog.openNameDialog({
      title: 'Duplicate Dashboard',
      name: `${currentName}-copy`,
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
