import { Component, OnInit, Inject, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { SignalKService } from '../signalk.service';
import { DataSetService, IDataSet } from '../data-set.service';

interface settingsForm {
  selectedPath: string;
  selectedSource: string;
  interval: number;
  dataPoints: number;
};

@Component({
  selector: 'app-settings-datasets',
  templateUrl: './settings-datasets.component.html',
  styleUrls: ['./settings-datasets.component.scss']
})
export class SettingsDatasetsComponent implements OnInit, AfterViewInit {

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  selectedDataSet: string;
  dataSets: IDataSet[];
  tableData = new MatTableDataSource([]);
  displayedColumns: string[] = ['path', 'updateTimer', 'dataPoints', 'actions'];

  constructor(
    public dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    private SignalKService: SignalKService,
    private DataSetService: DataSetService
    ) { }

  ngOnInit() {
    this.loadDataSets();
  }

  private loadDataSets() {
    this.tableData.data = this.DataSetService.getDataSets();
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
      const thisDataset: IDataSet = this.tableData.data.find((dataset: IDataSet) => {
        return dataset.uuid === uuid;
        });

      if (thisDataset) {
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
          data: thisDataset
        });
      }
    } else {
        dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
        });
    }

    dialogRef.afterClosed().subscribe((dataset: IDataSet) => {
      if (dataset === undefined || !dataset) {
        return; //clicked Cancel, click outside the dialog, or navigated await from page using url bar.
      } else {
        if (dataset.uuid) {
          this.editDataset(dataset);
        } else {
          this.addDataset(dataset);
        }

        this.loadDataSets();
      }
      });
  }

  private addDataset(dataset: IDataSet) {
    this.DataSetService.addDataSet(dataset.path, dataset.signalKSource, dataset.updateTimer, dataset.dataPoints);
  }

  private editDataset(dataset: IDataSet) {
    this.DataSetService.updateDataset(dataset);
  }

  public deleteDataset(uuid: string) {
    this.DataSetService.deleteDataSet(uuid); //TODO, bit bruteforce, can cause errors cause dataset deleted before subscrioptions canceled
    this.loadDataSets();
  }

  public trackByUuid(index: number, item: IDataSet): string {
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
  selector: 'app-settings-datasets-modal',
  templateUrl: './settings-datasets.modal.html',
  styleUrls: ['./settings-datasets.component.scss']
})
export class SettingsDatasetsModalComponent implements OnInit {
  public titleDialog: string = null;
  public newDataset: IDataSet = {
    uuid: null,
    path: null,
    signalKSource: null,
    updateTimer: 1,
    dataPoints: 30,
    name: null,
  }

  public formDataset: IDataSet = null;

  public availablePaths: string[] = [];
  public availableSources: string[] = [];
  public filterSelfPaths:boolean = true;

  constructor(
    private SignalKService: SignalKService,
    public dialogRef:MatDialogRef<SettingsDatasetsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dataset: IDataSet
    ) { }

  ngOnInit() {
    if (this.dataset) {
      this.titleDialog = "Edit Dataset";
      this.formDataset = this.dataset;

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
