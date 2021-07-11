import { Component, OnInit, Inject, Input, ViewChild, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription, Observable } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { AppSettingsService, IZone, ZoneState } from '../app-settings.service';
import { IPathAndMetaObjects } from "../signalk-interfaces";

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

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }

  delZone(uuid: string) {
    let zones = this.appSettingsService.getZones();
    //find index
    let index = zones.findIndex(zone => (zone.uuid == uuid));
    if (index >= 0) {
      zones.splice(index,1);
      this.appSettingsService.saveZones(zones);
    }
  }

  trackByUuid(index: number, item: IZone): string {
    return `${item.uuid}`;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableData.filter = filterValue.trim().toLowerCase();

    if (this.tableData.paginator) {
      this.tableData.paginator.firstPage();
    }
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogNewZone, {
      width: '80%',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log(result);
        let zones = this.appSettingsService.getZones();
        zones.push({
          uuid: this.newUuid(),
          upper: result.upper,
          lower: result.lower,
          path: result.path.path,
          unit: result.path.convertUnitTo,
          state: parseInt(result.state)
        });
        console.log(zones);
        this.appSettingsService.saveZones(zones);
      }
    });
  }


}



@Component({
  selector: 'dialog-new-zone',
  templateUrl: 'settings-zones.modal.html',
  styleUrls: ['./settings-zones.modal.css']
})
export class DialogNewZone {

  newZoneForm: FormGroup = new FormGroup({
    upper: new FormControl(null),
    lower: new FormControl(null),
    state: new FormControl('0', Validators.required),
    filterSelfPaths: new FormControl(true),
    path: new FormGroup({
      description: new FormControl("Numeric Data"),
      path: new FormControl(null),
      isPathConfigurable: new FormControl(true),
      convertUnitTo: new FormControl("unitless"),
      pathType: new FormControl("number"),
      source: new FormControl(null)
    })
  }, this.rangeValidationFunction);

  @Input() filterSelfPaths: boolean;
  availablePaths: IPathAndMetaObjects[];
  filteredPaths: Observable<IPathAndMetaObjects[]> = new Observable;

  selectedUnit = null;

  constructor(
    public dialogRef: MatDialogRef<DialogNewZone>,
    @Inject(MAT_DIALOG_DATA) public data) {
    }


  rangeValidationFunction(formGroup: FormGroup): any {
      let upper = formGroup.get('upper').value;
      let lower = formGroup.get('lower').value;
      return ((upper === null) && (lower === null)) ? { needUpperLower: true } : null;
   }

  onNoClick(): void {
    this.dialogRef.close();
  }
  submitConfig() {
    this.dialogRef.close(this.newZoneForm.value);
  }
}
