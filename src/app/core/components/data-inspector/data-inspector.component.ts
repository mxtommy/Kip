import { Component, AfterViewInit, OnDestroy, inject, DestroyRef, Signal, effect, viewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { DataInspectorRowComponent } from '../data-inspector-row/data-inspector-row.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { Subject } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, debounceTime } from 'rxjs/operators';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { Clipboard } from '@angular/cdk/clipboard';

import { DataService } from '../../services/data.service';
import { ISkPathData } from "../../interfaces/app-interfaces";
import { ToastService } from '../../services/toast.service';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'data-inspector',
  templateUrl: './data-inspector.component.html',
  styleUrls: ['./data-inspector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ MatFormFieldModule, MatTableModule, MatInputModule, MatPaginatorModule, MatSortModule, DataInspectorRowComponent, KeyValuePipe, PageHeaderComponent, MatButtonModule, MatIconModule, MatTooltipModule]
})
export class DataInspectorComponent implements AfterViewInit, OnDestroy {
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly _responsive = inject(BreakpointObserver);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(ToastService);
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
      debounceTime(350)
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
          paths.filter(path => Object.keys(path.sources || {}).length > 0)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((filteredPaths: ISkPathData[]) => {
        this.tableData.data = filteredPaths;
        this.cdr.markForCheck();
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

  protected applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.filterSubject.next(filterValue);
  }

  protected trackByPath(index: number, item: ISkPathData): string {
    return `${item.path}`;
  }

  protected trackBySource(index: number, item: { key: string }): string {
    return `${item.key}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getSourceKey(source: { key: any, value: any }): string {
    return String(source.key);
  }

  protected getSourceValue(item: { key: unknown, value: { sourceValue: unknown } } ): unknown {
    const value = item.value?.sourceValue;
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
  }

  protected copyPath(path: string | null | undefined, ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!path) return;

    const ok = this.clipboard.copy(path);
    if (ok) {
      this.toast.show('Path copied to clipboard', 100, true, 'success');
    } else {
      this.toast.show('Copy to clipboard failed', 1500, false, 'error');
    }
  }

  ngOnDestroy(): void {
    this.filterSubject.complete(); // Clean up the Subject
    this.dataService.stopSkDataFullTree();
  }
}
