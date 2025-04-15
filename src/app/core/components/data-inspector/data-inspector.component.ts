import { Component, AfterViewInit, OnDestroy, viewChild, inject, DestroyRef } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { DataService } from '../../services/data.service';
import { ISkPathData } from "../../interfaces/app-interfaces";
import { DataBrowserRowComponent } from '../data-browser-row/data-browser-row.component';
import { KeyValuePipe } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, throttleTime } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';


@Component({
    selector: 'data-inspector',
    templateUrl: './data-inspector.component.html',
    styleUrls: ['./data-inspector.component.scss'],
    standalone: true,
    imports: [ MatFormFieldModule, MatTableModule, MatInputModule, MatPaginatorModule, MatSortModule, DataBrowserRowComponent, KeyValuePipe, PageHeaderComponent]
})
export class DataInspectorComponent implements AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private destroyRef = inject(DestroyRef);
  private filterSubject = new Subject<string>();

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  protected readonly pageTitle = 'Data Inspector';

  public pageSize: number = 10;
  public tableData = new MatTableDataSource<ISkPathData>([]);
  public displayedColumns: string[] = ['path', 'defaultSource'];

  constructor() {
    this.filterSubject.pipe(
      debounceTime(3000)
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(filterValue => {
      this.tableData.filter = filterValue.trim().toLowerCase();
      if (this.tableData.paginator) {
        this.tableData.paginator.firstPage();
      }
    });
  }

  ngAfterViewInit() {
    this.dataService.startSkDataFullTree()
      .pipe(
        map((paths: ISkPathData[]) =>
          paths
            .filter(path => Object.keys(path.sources || {}).length > 0) // Filter out items with empty sources
            .map(path => ({
              ...path,
              sources: path.type && path.type.includes('object') && typeof path.sources === 'object'
                ? Object.fromEntries(
                    Object.entries(path.sources).map(([key, value]) => [
                      key,
                      {
                        ...value,
                        sourceValue: typeof value.sourceValue === 'object'
                          ? JSON.stringify(value.sourceValue) // Stringify only sourceValue if it's an object
                          : value.sourceValue
                      }
                    ])
                  ) // Transform only sourceValue in sources if path.type contains 'object'
                : path.sources
            }))
        ),
        throttleTime(500), // Emit at most once every 500ms
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((filteredPaths: ISkPathData[]) => {
        this.tableData.data = filteredPaths;
      });

    this.tableData.paginator = this.paginator();
    this.tableData.sort = this.sort();
    this.tableData.filter = "self.";
  }

  public applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.filterSubject.next(filterValue);
  }

  public trackByPath(index: number, item: ISkPathData): string {
    return `${item.path}`;
  }

  public trackBySource(index: number, item): string {
    return `${item.key}`;
  }

  getSourceKey(source: { key: any, value: any }): string {
    return String(source.key);
  }

  getSourceValue(item: { key: any, value: any } ): any {
    return item.value.sourceValue;
  }

  ngOnDestroy(): void {
    this.filterSubject.complete(); // Clean up the Subject
    this.dataService.stopSkDataFullTree();
  }
}
