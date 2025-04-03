import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy, viewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';

import { DataService } from '../../services/data.service';
import { ISkPathData } from "../../interfaces/app-interfaces";
import { DataBrowserRowComponent } from '../data-browser-row/data-browser-row.component';
import { NgFor, KeyValuePipe } from '@angular/common';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { PageHeaderComponent } from '../page-header/page-header.component';


@Component({
    selector: 'data-inspector',
    templateUrl: './data-inspector.component.html',
    styleUrls: ['./data-inspector.component.css'],
    standalone: true,
    imports: [ MatFormField, MatLabel, MatInput, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatSortHeader, MatCellDef, MatCell, NgFor, DataBrowserRowComponent, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow, MatPaginator, KeyValuePipe, PageHeaderComponent]
})
export class DataInspectorComponent implements OnInit, AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private cdRef = inject(ChangeDetectorRef);

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  protected readonly pageTitle = 'Data Inspector';
  private pathsSubscription: Subscription = null;
  private dataTableTimer: NodeJS.Timeout = null;

  public pageSize: number = 10;
  public tableData = new MatTableDataSource<ISkPathData>([]);
  public displayedColumns: string[] = ['path', 'defaultSource'];

  public onResize(event) {
    this.setNumPerPage(event.target.innerHeight, event.target.innerWidth);
  }

  ngOnInit() {
    this.dataTableTimer = setTimeout(()=>{
      this.pathsSubscription = this.dataService.startSkDataFullTree().subscribe((paths: ISkPathData[]) => {
        this.tableData.data = paths;
      })}, 0); // set timeout to make it async otherwise delays page load
  }

  ngAfterViewInit() {
    this.tableData.paginator = this.paginator();
    this.tableData.sort = this.sort();
    this.tableData.filter = "self.";
    this.setNumPerPage(window.innerHeight, window.innerWidth);
    this.cdRef.detectChanges();
  }

  public applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableData.filter = filterValue.trim().toLowerCase();

    if (this.tableData.paginator) {
      this.tableData.paginator.firstPage();
    }
  }

  public trackByPath(index: number, item: ISkPathData): string {
    return `${item.path}`;
  }

  public trackBySource(index: number, item): string {
    return `${item.key}`;
  }

  private setNumPerPage(height: number, width: number){
    if (width < 750) {
      this.pageSize = 5;
    } else if (height > 900) {
      this.pageSize = 15;
    } else if (height > 750 && height < 900) {
      this.pageSize = 10;
    } else {
      this.pageSize = 5;
    }
  }

  getSourceKey(source: { key: unknown, value: any }): string {
    return String(source.key);
  }

  getSourceValue(item: { key: any, value: any } ): any {
    return item.value.sourceValue;
  }

  ngOnDestroy(): void {
    clearTimeout(this.dataTableTimer);
    this.tableData.data = null
    this.tableData = null;
    this.pathsSubscription?.unsubscribe();
    this.dataService.stopSkDataFullTree();
  }
}
