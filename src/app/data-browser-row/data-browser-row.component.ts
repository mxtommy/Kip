import { Component, Input, OnInit, ViewEncapsulation, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { SignalKService } from '../signalk.service';
import { UnitsService } from '../units.service';


@Component({
  selector: 'data-browser-row',
  templateUrl: './data-browser-row.component.html',
  styleUrls: ['./data-browser-row.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class DataBrowserRowComponent implements OnInit {

  @Input('path') path: string;
  @Input('source') source: string;
  @Input('pathValue') pathValue: any;

  units = null;
  selectedUnit: string = "unitless"

  constructor(
    private signalKService: SignalKService,
    private unitsService: UnitsService,
    public dialog: MatDialog
  ) {

  }

  ngOnInit() {
    this.units = this.signalKService.getConversionsForPath(this.path);
    this.selectedUnit = this.units.default;
  }

  convertValue(value: any) {
    if (typeof(value) != "number") {
      return value; //is a string or bool or ??
    }
    let converted = this.unitsService.convertUnit(this.selectedUnit, value);

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
})
export class DialogUnitSelect {

  selectedUnit = null;

  constructor(
    public dialogRef: MatDialogRef<DialogUnitSelect>,
    @Inject(MAT_DIALOG_DATA) public data) {
    }
}
