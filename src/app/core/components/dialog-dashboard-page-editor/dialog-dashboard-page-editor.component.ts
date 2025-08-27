import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { DialogNameData } from '../../interfaces/dialog-data';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'dialog-dashboard-page-editor',
  standalone: true,
  imports: [ MatDialogModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule ],
  templateUrl: './dialog-dashboard-page-editor.component.html',
  styleUrl: './dialog-dashboard-page-editor.component.scss'
})
export class DialogDashboardPageEditorComponent {
  protected dialogRef = inject<MatDialogRef<DialogDashboardPageEditorComponent>>(MatDialogRef);
  protected data = inject<DialogNameData>(MAT_DIALOG_DATA);

  protected saveName(): void {
    this.dialogRef.close(this.data);
  }
}
