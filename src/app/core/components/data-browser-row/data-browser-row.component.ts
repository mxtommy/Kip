import { Component, OnInit, ViewEncapsulation, input, inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { DataService } from '../../services/data.service';
import { UnitsService } from '../../services/units.service';
import { MatCell } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
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
    imports: [MatCell, MatButtonModule]
})
export class DataBrowserRowComponent implements OnInit {
  private unitsService = inject(UnitsService);
  dialog = inject(MatDialog);


  readonly path = input<string>(undefined);
  readonly source = input<string>(undefined);
  readonly pathValue = input<any>(undefined);

  units = null;
  selectedUnit: string = "unitless"

  ngOnInit() {
    this.units = this.unitsService.getConversionsForPath(this.path());
    this.selectedUnit = this.units.base;
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
        MatButtonModule,
        MatDialogClose
    ],
})
export class DialogUnitSelect {
  dialogRef = inject<MatDialogRef<DialogUnitSelect>>(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);


  selectedUnit = null;
}
