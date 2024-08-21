import { Component, Input, OnInit, ViewEncapsulation, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { DataService } from '../../services/data.service';
import { UnitsService } from '../../services/units.service';
import { MatCell } from '@angular/material/table';
import { MatButton } from '@angular/material/button';
import { MatOptgroup, MatOption } from '@angular/material/core';
import { NgFor } from '@angular/common';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';


@Component({
    selector: 'data-browser-row',
    templateUrl: './data-browser-row.component.html',
    styleUrls: ['./data-browser-row.component.css'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatCell, MatButton],
})
export class DataBrowserRowComponent implements OnInit {

  @Input('path') path: string;
  @Input('source') source: string;
  @Input('pathValue') pathValue: any;

  units = null;
  selectedUnit: string = "unitless"

  constructor(
    private DataService: DataService,
    private unitsService: UnitsService,
    public dialog: MatDialog
  ) {

  }

  ngOnInit() {
    this.units = this.unitsService.getConversionsForPath(this.path);
    this.selectedUnit = this.units.default;
  }

  convertValue(value: any) {
    if (typeof(value) != "number") {
      return value; //is a string or bool or ??
    }
    let converted = this.unitsService.convertToUnit(this.selectedUnit, value);

    return converted;
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogUnitSelect, {
      data: {selectedUnit: this.selectedUnit, units: this.units}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedUnit = result;
      }
    });
  }
}



@Component({
    selector: 'dialog-unit-selector',
    templateUrl: 'data-browser-row-unit-modal.html',
    standalone: true,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatFormField,
        MatLabel,
        MatSelect,
        NgFor,
        MatOptgroup,
        MatOption,
        MatDialogActions,
        MatButton,
        MatDialogClose,
    ],
})
export class DialogUnitSelect {

  selectedUnit = null;

  constructor(
    public dialogRef: MatDialogRef<DialogUnitSelect>,
    @Inject(MAT_DIALOG_DATA) public data) {
    }
}
