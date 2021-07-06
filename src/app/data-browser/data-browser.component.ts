import { Component, OnInit, AfterViewInit, ViewChild,ElementRef,ChangeDetectorRef} from '@angular/core';
import { Subscription, Observable, ReplaySubject } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { AppSettingsService } from '../app-settings.service';
import { SignalKService } from '../signalk.service';
import { IPathObject, IPathAndMetaObjects } from "../signalk-interfaces";


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
    private appSettingsService: AppSettingsService,
    private SignalKService: SignalKService,
    private el:ElementRef,
    private cdRef: ChangeDetectorRef,
  ) { 
    
  }

  onResize(event) {
    this.setNumPerPage(event.target.innerHeight);
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
    this.setNumPerPage(window.innerHeight);
    this.cdRef.detectChanges();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableData.filter = filterValue.trim().toLowerCase();

    if (this.tableData.paginator) {
      this.tableData.paginator.firstPage();
    }
  }
  
  trackByPath(index: number, item: IPathObject): string {
    return `${item.path}`;
  }

  trackBySource(index: number, item): string {
    return `${item.key}`;
  }


  setNumPerPage(heightPx: number){
    if (heightPx > 750 && heightPx < 900) {
      this.pageSize = 10;
    }
    else if (heightPx > 900) {
      this.pageSize = 15;
    } else {
      this.pageSize = 5;
    }
  }


  

}
