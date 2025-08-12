import { MatIconModule } from '@angular/material/icon';
import { Component, AfterViewInit, OnDestroy, inject, DestroyRef, Signal, effect, viewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { DataService } from '../../services/data.service';
import { ISkPathData } from "../../interfaces/app-interfaces";
import { DataInspectorRowComponent } from '../data-inspector-row/data-inspector-row.component';
import { KeyValuePipe } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, throttleTime } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';


@Component({
    selector: 'data-inspector',
    templateUrl: './data-inspector.component.html',
    styleUrls: ['./data-inspector.component.scss'],
    imports: [ MatFormFieldModule, MatTableModule, MatInputModule, MatPaginatorModule, MatSortModule, DataInspectorRowComponent, KeyValuePipe, PageHeaderComponent, MatIconModule]
})
export class DataInspectorComponent implements AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private destroyRef = inject(DestroyRef);
  private _responsive = inject(BreakpointObserver);
  private isPhonePortrait: Signal<BreakpointState>;
  private filterSubject = new Subject<string>();

  readonly paginator = viewChild.required(MatPaginator);
  readonly sort = viewChild.required(MatSort);
  protected readonly pageTitle = 'Data Inspector';

  public pageSize = 25;
  protected hidePageSize = false;
  protected showFirstLastButtons = true;
  protected showPageSizeOptions = [5, 10, 25, 100];
  public tableData = new MatTableDataSource<ISkPathData>([]);
  public displayedColumns: string[] = ['path', 'supportsPut', 'defaultSource'];

  constructor() {
    this.filterSubject.pipe(
      debounceTime(500)
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(filterValue => {
      this.tableData.filter = filterValue.trim().toLowerCase();
      if (this.tableData.paginator) {
        this.tableData.paginator.firstPage();
      }
    });

    this.isPhonePortrait = toSignal(this._responsive.observe(Breakpoints.HandsetPortrait));

    effect(() => {
      if (this.isPhonePortrait().matches) {
        this.hidePageSize = true;
        this.showFirstLastButtons = false;
        this.showPageSizeOptions = [];
      } else {
        this.hidePageSize = false;
        this.showFirstLastButtons = true;
        this.showPageSizeOptions = [5, 10, 25, 100];
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

    // Assign paginator and sort to the tableData
    this.tableData.paginator = this.paginator();
    this.tableData.sort = this.sort();

    // Add a custom sorting accessor for the "supportsPut" column
    this.tableData.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'supportsPut':
          return item.meta?.supportsPut ? 1 : 0; // Sort by boolean value (1 for true, 0 for false)
        default:
          return item[property]; // Default sorting for other columns
      }
    };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSourceKey(source: { key: any, value: any }): string {
    return String(source.key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSourceValue(item: { key: any, value: any } ): any {
    return item.value.sourceValue;
  }

  ngOnDestroy(): void {
    this.filterSubject.complete(); // Clean up the Subject
    this.dataService.stopSkDataFullTree();
  }
}
