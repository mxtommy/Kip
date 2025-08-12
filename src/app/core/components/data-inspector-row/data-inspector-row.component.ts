import { Component, OnInit, ViewEncapsulation, input, inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { UnitsService } from '../../services/units.service';
import { MatCell } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatOptgroup, MatOption } from '@angular/material/core';

import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';


@Component({
    selector: 'data-inspector-row',
    templateUrl: './data-inspector-row.component.html',
    styleUrls: ['./data-inspector-row.component.css'],
    encapsulation: ViewEncapsulation.None,
    imports: [MatCell, MatButtonModule]
})
export class DataInspectorRowComponent implements OnInit {
  private _units = inject(UnitsService);
  private _dialog = inject(MatDialog);
  readonly path = input.required<string>();
  readonly source = input<string>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly pathValue = input<any>(undefined);
  readonly type = input.required<string>();

  units = null;
  selectedUnit = "unitless"

  ngOnInit() {
    this.units = this._units.getConversionsForPath(this.path());
    this.selectedUnit = this.units.base;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected convertValue(value: any, type: string): any {
    if (type === 'number')
      return this._units.convertToUnit(this.selectedUnit, value);
    else {
      return value;
    }
  }

  openDialog(): void {
    const dialogRef = this._dialog.open(DialogUnitSelect, {
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
    templateUrl: 'data-inspector-row-unit-modal.html',
    imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
    MatSelect,
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
