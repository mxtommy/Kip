import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DialogNameData } from '../../interfaces/dialog-data';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'dialog-name',
  standalone: true,
  imports: [ MatDialogModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule ],
  templateUrl: './dialog-name.component.html',
  styleUrl: './dialog-name.component.scss'
})
export class DialogNameComponent {
  constructor(
    protected dialogRef: MatDialogRef<DialogNameComponent>,
    @Inject(MAT_DIALOG_DATA) protected data: DialogNameData) {}

  protected saveName(): void {
    this.dialogRef.close(this.data);
  }
}
