import { Component, OnInit, AfterViewInit, ViewChild,ElementRef,ChangeDetectorRef} from '@angular/core';
import { Subscription } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { SignalKService } from '../signalk.service';
import { IPathData } from "../app-interfaces";


@Component({
  selector: 'data-browser',
  templateUrl: './data-browser.component.html',
  styleUrls: ['./data-browser.component.css']
})
export class DataBrowserComponent implements OnInit, AfterViewInit {

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  pathsSub: Subscription;
  pageSize = 10;


  tableData = new MatTableDataSource([]);

  displayedColumns: string[] = ['path', 'defaultSource'];

  constructor(
    private SignalKService: SignalKService,
    private cdRef: ChangeDetectorRef,
  ) {

  }

  public onResize(event) {
    this.setNumPerPage(event.target.innerHeight, event.target.innerWidth);
  }

  ngOnInit() {
    setTimeout(()=>{
      this.pathsSub = this.SignalKService.getPathsObservable().subscribe(paths => {
        this.tableData.data = paths
      })},0); // settimeout to make it async otherwise delays page load
  }

  ngAfterViewInit() {
    this.tableData.paginator = this.paginator;
    this.tableData.sort = this.sort;
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

  public trackByPath(index: number, item: IPathData): string {
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
}
