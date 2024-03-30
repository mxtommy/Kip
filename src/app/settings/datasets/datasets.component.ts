import { cloneDeep } from 'lodash-es';
import { Component, OnInit, Inject, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent } from '@angular/material/dialog';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';

import { SignalKDataService } from '../../core/services/signalk-data.service';
import { DatasetService, IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import { FilterSelfPipe } from '../../core/pipes/filter-self.pipe';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { NgFor } from '@angular/common';
import { MatSelect } from '@angular/material/select';
import { MatStepper, MatStep, MatStepLabel, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';
import { MatDivider } from '@angular/material/divider';
import { MatButton } from '@angular/material/button';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';

interface settingsForm {
  selectedPath: string;
  selectedSource: string;
  interval: number;
  dataPoints: number;
};

@Component({
    selector: 'settings-datasets',
    templateUrl: './datasets.component.html',
    styleUrls: ['./datasets.component.scss'],
    standalone: true,
    imports: [FormsModule, MatFormField, MatLabel, MatInput, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatSortHeader, MatCellDef, MatCell, MatButton, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow, MatPaginator, MatDivider]
})
export class SettingsDatasetsComponent implements OnInit, AfterViewInit {

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  selectedDataset: string;
  tableData = new MatTableDataSource([]);
  displayedColumns: string[] = ['path', 'pathSource', 'timeScaleFormat', 'period', 'actions'];

  constructor(
    public dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    private dsService: DatasetService
    ) { }

  ngOnInit() {
    this.loadDatasets();
  }

  private loadDatasets() {
    this.tableData.data = this.dsService.list();
  }

  ngAfterViewInit() {
    this.tableData.paginator = this.paginator;
    this.tableData.sort = this.sort;
    this.tableData.filter = "";
    this.cdRef.detectChanges();
  }

  public openDatasetModal(uuid?: string) {
    let dialogRef;

    if (uuid) {
      const thisDataset: IDatasetServiceDatasetConfig = cloneDeep(
        this.tableData.data.find(
          (dataset: IDatasetServiceDatasetConfig) =>
          {
            return dataset.uuid === uuid;
          }
        )
      );

      if (thisDataset) {
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
          data: thisDataset
        });
      }
    } else {
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
        });
    }

    dialogRef.afterClosed().subscribe((dataset: IDatasetServiceDatasetConfig) => {
      if (dataset === undefined || !dataset) {
        return;   //clicked Cancel, click outside the dialog, or navigated await from page using url bar.
      } else {
        dataset.label = `${dataset.path}, Source: ${dataset.pathSource}, Scale: ${dataset.timeScaleFormat}, Period: ${dataset.period} `;
        if (dataset.uuid) {
          this.editDataset(dataset);
        } else {
          this.addDataset(dataset);
        }

        this.loadDatasets();
      }
    });
  }

  private addDataset(dataset: IDatasetServiceDatasetConfig) {
    this.dsService.create(dataset.path, dataset.pathSource, dataset.timeScaleFormat, dataset.period, dataset.label);
  }

  private editDataset(dataset: IDatasetServiceDatasetConfig) {
    this.dsService.edit(dataset);
  }

  public deleteDataset(uuid: string) {
    this.dsService.remove(uuid);
    this.loadDatasets();
  }

  public trackByUuid(index: number, item: IDatasetServiceDatasetConfig): string {
    return `${item.uuid}`;
  }

  public applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableData.filter = filterValue.trim().toLowerCase();

    if (this.tableData.paginator) {
      this.tableData.paginator.firstPage();
    }
  }

}

@Component({
    selector: 'settings-datasets-modal',
    templateUrl: './datasets.modal.html',
    styleUrls: ['./datasets.component.scss'],
    standalone: true,
    imports: [MatRadioModule, MatDialogTitle, MatDialogContent, FormsModule, MatStepper, MatStep, MatStepLabel, MatFormField, MatLabel, MatSelect, NgFor, MatOption, MatCheckbox, MatDivider, MatButton, MatStepperNext, MatInput, MatStepperPrevious, FilterSelfPipe]
})
export class SettingsDatasetsModalComponent implements OnInit {
  public titleDialog: string = null;
  public newDataset: IDatasetServiceDatasetConfig = {
    uuid: null,
    path: null,
    pathSource: null,
    baseUnit: null,
    timeScaleFormat: "second",
    period: 10,
    label: null
  }

  public formDataset: IDatasetServiceDatasetConfig = null;

  public availablePaths: string[] = [];
  public availableSources: string[] = [];
  public filterSelfPaths:boolean = true;

  constructor(
    private SignalKDataService: SignalKDataService,
    public dialogRef:MatDialogRef<SettingsDatasetsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dataset: IDatasetServiceDatasetConfig
    ) { }

  ngOnInit() {
    if (this.dataset) {
      this.titleDialog = "Edit Dataset";
      this.formDataset = this.dataset;

      let pathObject = this.SignalKDataService.getPathObject(this.formDataset.path);
      if (pathObject !== null) {
        this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      }

    } else {
      this.titleDialog = "Add Dataset";
      this.formDataset = this.newDataset;
    }

    this.availablePaths = this.SignalKDataService.getPathsByType('number').sort();
  }

  public changePath() { // called when we choose a new path. Resets the form old value with default info of this path
    let pathObject = this.SignalKDataService.getPathObject(this.formDataset.path);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.formDataset.pathSource = 'default';
  }

  public closeForm() {
    this.dialogRef.close(this.formDataset);
  }
}
