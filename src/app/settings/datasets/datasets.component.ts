import { Component, OnInit, Inject, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent } from '@angular/material/dialog';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';

import { SignalKService } from '../../core/services/signalk.service';
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

interface settingsForm {
  selectedPath: string;
  selectedSource: string;
  interval: number;
  dataPoints: number;
};

@Component({
    selector: 'settings-datasets',
    templateUrl: './Datasets.component.html',
    styleUrls: ['./Datasets.component.scss'],
    standalone: true,
    imports: [FormsModule, MatFormField, MatLabel, MatInput, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatSortHeader, MatCellDef, MatCell, MatButton, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow, MatPaginator, MatDivider]
})
export class SettingsDatasetsComponent implements OnInit, AfterViewInit {

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  selectedDataset: string;
  Datasets: IDatasetServiceDatasetConfig[];
  tableData = new MatTableDataSource([]);
  displayedColumns: string[] = ['path', 'sampleTime', 'dataPoints', 'actions'];

  constructor(
    public dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    private DatasetService: DatasetService
    ) { }

  ngOnInit() {
    this.loadDatasets();
  }

  private loadDatasets() {
    this.tableData.data = this.DatasetService.list();
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
      const thisDataset: IDatasetServiceDatasetConfig = this.tableData.data.find((Dataset: IDatasetServiceDatasetConfig) => {
        return Dataset.uuid === uuid;
        });

      if (thisDataset) {
        thisDataset.sampleTime = thisDataset.sampleTime / 1000; // data in ms but displayed in sec
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
          data: thisDataset
        });
      }
    } else {
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
        });
    }

    dialogRef.afterClosed().subscribe((Dataset: IDatasetServiceDatasetConfig) => {
      if (Dataset === undefined || !Dataset) {
        return; //clicked Cancel, click outside the dialog, or navigated await from page using url bar.
      } else {
        Dataset.sampleTime = Dataset.sampleTime * 1000; // value needed in ms
        if (Dataset.uuid) {
          this.editDataset(Dataset);
        } else {
          this.addDataset(Dataset);
        }

        this.loadDatasets();
      }
      });
  }

  private addDataset(Dataset: IDatasetServiceDatasetConfig) {
    this.DatasetService.create(Dataset.path, Dataset.signalKSource, Dataset.sampleTime, Dataset.maxDataPoints, 3);
  }

  private editDataset(Dataset: IDatasetServiceDatasetConfig) {
    this.DatasetService.edit(Dataset);
  }

  public deleteDataset(uuid: string) {
    this.DatasetService.remove(uuid); //TODO, bit bruteforce, can cause errors cause Dataset deleted before subscrioptions canceled
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
    selector: 'settings-Datasets-modal',
    templateUrl: './Datasets.modal.html',
    styleUrls: ['./Datasets.component.scss'],
    standalone: true,
    imports: [MatDialogTitle, MatDialogContent, FormsModule, MatStepper, MatStep, MatStepLabel, MatFormField, MatLabel, MatSelect, NgFor, MatOption, MatCheckbox, MatDivider, MatButton, MatStepperNext, MatInput, MatStepperPrevious, FilterSelfPipe]
})
export class SettingsDatasetsModalComponent implements OnInit {
  public titleDialog: string = null;
  public newDataset: IDatasetServiceDatasetConfig = {
    uuid: null,
    path: null,
    signalKSource: null,
    sampleTime: 1,
    maxDataPoints: 30,
    smaPeriod: 3,
    label: null,
  }

  public formDataset: IDatasetServiceDatasetConfig = null;

  public availablePaths: string[] = [];
  public availableSources: string[] = [];
  public filterSelfPaths:boolean = true;

  constructor(
    private SignalKService: SignalKService,
    public dialogRef:MatDialogRef<SettingsDatasetsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public Dataset: IDatasetServiceDatasetConfig
    ) { }

  ngOnInit() {
    if (this.Dataset) {
      this.titleDialog = "Edit Dataset";
      this.formDataset = this.Dataset;

      let pathObject = this.SignalKService.getPathObject(this.formDataset.path);
      if (pathObject !== null) {
        this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      }

    } else {
      this.titleDialog = "Add Dataset";
      this.formDataset = this.newDataset;
    }

    this.availablePaths = this.SignalKService.getPathsByType('number').sort();
  }

  public changePath() { // called when we choose a new path. Resets the form old value with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.formDataset.path);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.formDataset.signalKSource = 'default';
  }

  public closeForm() {
    this.dialogRef.close(this.formDataset);
  }
}
