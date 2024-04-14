import { Component, OnInit, Inject, Input, ViewChild, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow } from '@angular/material/table';
import { Subscription, Observable } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';

import { AppSettingsService } from '../../core/services/app-settings.service';
import { IPathMetaData } from "../../core/interfaces/app-interfaces";
import { IZone } from "../../core/interfaces/app-settings.interfaces";
import { UUID } from '../../utils/uuid';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { ModalPathControlConfigComponent } from '../../widget-config/path-control-config/path-control-config.component';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { MatButton } from '@angular/material/button';
import { NgSwitch, NgSwitchCase, NgIf } from '@angular/common';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { cloneDeep } from 'lodash-es';

@Component({
    selector: 'settings-zones',
    templateUrl: './zones.component.html',
    styleUrls: ['./zones.component.css'],
    standalone: true,
    imports: [MatFormField, MatLabel, MatInput, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatSortHeader, MatCellDef, MatCell, NgSwitch, NgSwitchCase, MatButton, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatNoDataRow, MatPaginator, MatDivider]
})
export class SettingsZonesComponent implements OnInit, AfterViewInit, OnDestroy {

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
      const thisZone: IZone = cloneDeep(
          this.tableData.data.find((zone: IZone) => {
          return zone.uuid === uuid;
          })
        );

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
          zone.uuid = UUID.create();
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

  ngOnDestroy(): void {
    this.zonesSub?.unsubscribe();
  }
}


// Add zone component
@Component({
    selector: 'dialog-new-zone',
    templateUrl: 'new-zone.modal.html',
    styleUrls: ['./new-zone.modal.css'],
    standalone: true,
    imports: [MatDialogTitle, FormsModule, ReactiveFormsModule, MatDialogContent, MatCheckbox, ModalPathControlConfigComponent, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatDivider, MatDialogActions, MatButton, MatDialogClose, NgIf, MatError]
})
export class DialogNewZone {

  zoneForm: UntypedFormGroup = new UntypedFormGroup({
    upper: new UntypedFormControl(null),
    lower: new UntypedFormControl(null),
    state: new UntypedFormControl('0', Validators.required),
    filterSelfPaths: new UntypedFormControl(true),
    path: new UntypedFormGroup({
      path: new UntypedFormControl(null),
      isPathConfigurable: new UntypedFormControl(true),
      convertUnitTo: new UntypedFormControl("unitless"),
      pathType: new UntypedFormControl("number"),
      source: new UntypedFormControl(null)
    })
  }, this.rangeValidationFunction);

  @Input() filterSelfPaths: boolean;
  availablePaths: IPathMetaData[];
  filteredPaths: Observable<IPathMetaData[]> = new Observable;

  selectedUnit = null;

  constructor(
    public dialogRef: MatDialogRef<DialogNewZone>) {
    }

  rangeValidationFunction(formGroup: UntypedFormGroup): any {
      let upper = formGroup.get('upper').value;
      let lower = formGroup.get('lower').value;
      return ((upper === null) && (lower === null)) ? { needUpperLower: true } : null;
   }

   get getPathFormGroup(): UntypedFormGroup {
    return this.zoneForm.get('path') as UntypedFormGroup;
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


// Edit zone component
@Component({
    selector: 'dialog-edit-zone',
    templateUrl: 'edit-zone.modal.html',
    styleUrls: ['./edit-zone.modal.css'],
    standalone: true,
    imports: [FormsModule, MatDialogTitle, MatDialogContent, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatDivider, MatDialogActions, MatButton, MatDialogClose, NgIf, MatError]
})
export class DialogEditZone {

  constructor(
    public dialogRef: MatDialogRef<DialogEditZone>,
    @Inject(MAT_DIALOG_DATA) public zone: IZone,
    ) { }

  closeForm() {
    this.dialogRef.close(this.zone);
  }
}
