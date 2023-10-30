import { Component, OnInit, Inject, Input, ViewChild, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription, Observable } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { AppSettingsService } from '../app-settings.service';
import { IPathMetaData } from "../app-interfaces";
import { IZone } from "../app-settings.interfaces";

@Component({
  selector: 'app-settings-zones',
  templateUrl: './settings-zones.component.html',
  styleUrls: ['./settings-zones.component.css']
})
export class SettingsZonesComponent implements OnInit, AfterViewInit {

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  tableData = new MatTableDataSource([]);

  displayedColumns: string[] = ['path', 'unit', 'lower', 'upper', 'state', "actions"];



  zonesSub: Subscription;

  constructor(
    private appSettingsService: AppSettingsService,
    public dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    ) { }

  ngOnInit() {
    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(zones => {
      this.tableData.data = zones;
    });
  }

  ngAfterViewInit() {
    this.tableData.paginator = this.paginator;
    this.tableData.sort = this.sort;
    this.tableData.filter = "";
    this.cdRef.detectChanges();
  }

  public trackByUuid(index: number, item: IZone): string {
    return `${item.uuid}`;
  }

  public applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableData.filter = filterValue.trim().toLowerCase();

    if (this.tableData.paginator) {
      this.tableData.paginator.firstPage();
    }
  }

  public openZoneDialog(uuid?: string): void {
    let dialogRef;

    if (uuid) {
      const thisZone: IZone = this.tableData.data.find((zone: IZone) => {
        return zone.uuid === uuid;
        });

      if (thisZone) {
        dialogRef = this.dialog.open(DialogEditZone, {
          data: thisZone
        });
      }
    } else {
        dialogRef = this.dialog.open(DialogNewZone, {
        });
    }

    dialogRef.afterClosed().subscribe((zone: IZone) => {
      if (zone === undefined || !zone) {
        return; //clicked Cancel, click outside the dialog, or navigated await from page using url bar.
      } else {
        if (zone.uuid) {
          this.editZone(zone);
        } else {
          zone.uuid = this.newUuid();
          this.addZone(zone);
        }
      }
    });
  }

  public addZone(zone: IZone) {
    let zones: IZone[] = this.appSettingsService.getZones();
    zones.push(zone);
    this.appSettingsService.saveZones(zones);
  }

  public editZone(zone: IZone) {
    if (zone.uuid) { // is existing zone
      const zones: IZone[] = this.appSettingsService.getZones();
      const index = zones.findIndex(zones => zones.uuid === zone.uuid );

      if(index >= 0) {
        zones.splice(index, 1, zone);
        this.appSettingsService.saveZones(zones);
      }
    }
  }

  public deleteZone(uuid: string) {
    let zones = this.appSettingsService.getZones();
    //find index
    let index = zones.findIndex(zone => zone.uuid === uuid);
    if (index >= 0) {
      zones.splice(index, 1);
      this.appSettingsService.saveZones(zones);
    }
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }
}


// Add zone compoment
@Component({
  selector: 'dialog-new-zone',
  templateUrl: 'settings-new-zone.modal.html',
  styleUrls: ['./settings-new-zone.modal.css']
})
export class DialogNewZone {

  zoneForm: FormGroup = new FormGroup({
    upper: new FormControl(null),
    lower: new FormControl(null),
    state: new FormControl('0', Validators.required),
    filterSelfPaths: new FormControl(true),
    path: new FormGroup({
      path: new FormControl(null),
      isPathConfigurable: new FormControl(true),
      convertUnitTo: new FormControl("unitless"),
      pathType: new FormControl("number"),
      source: new FormControl(null)
    })
  }, this.rangeValidationFunction);

  @Input() filterSelfPaths: boolean;
  availablePaths: IPathMetaData[];
  filteredPaths: Observable<IPathMetaData[]> = new Observable;

  selectedUnit = null;

  constructor(
    public dialogRef: MatDialogRef<DialogNewZone>) {
    }

  rangeValidationFunction(formGroup: FormGroup): any {
      let upper = formGroup.get('upper').value;
      let lower = formGroup.get('lower').value;
      return ((upper === null) && (lower === null)) ? { needUpperLower: true } : null;
   }

  closeForm() {
    let zone: IZone = {
      uuid: null,
      upper: this.zoneForm.get('upper').value,
      lower: this.zoneForm.get('lower').value,
      path: this.zoneForm.get('path.path').value,
      unit: this.zoneForm.get('path.convertUnitTo').value,
      state: parseInt(this.zoneForm.get('state').value)
    };
    this.dialogRef.close(zone);
  }
}


// Edit zone compoment
@Component({
  selector: 'dialog-edit-zone',
  templateUrl: 'settings-edit-zone.modal.html',
  styleUrls: ['./settings-edit-zone.modal.css']
})
export class DialogEditZone {

  constructor(
    public dialogRef: MatDialogRef<DialogEditZone>,
    @Inject(MAT_DIALOG_DATA) public zone: IZone,
    ) {

    }

  closeForm() {
    this.dialogRef.close(this.zone);
  }
}
