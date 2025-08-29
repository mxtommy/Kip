import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { DialogDashboardPageEditorData } from '../../interfaces/dialog-data';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { SelectIconComponent } from '../select-icon/select-icon.component';

@Component({
  selector: 'dialog-dashboard-page-editor',
  standalone: true,
  imports: [ MatDialogModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule, SelectIconComponent ],
  templateUrl: './dialog-dashboard-page-editor.component.html',
  styleUrl: './dialog-dashboard-page-editor.component.scss'
})
export class DialogDashboardPageEditorComponent {
  protected dialogRef = inject<MatDialogRef<DialogDashboardPageEditorComponent>>(MatDialogRef);
  protected data = inject<DialogDashboardPageEditorData>(MAT_DIALOG_DATA);

  constructor() {
    // Set default icon if not provided
    if (!this.data.icon) {
      this.data.icon = 'dashboard-dashboard';
    }
  }

  protected save(): void {
    this.dialogRef.close(this.data);
  }

  protected onIconSelected(icon: string): void {
    this.data.icon = icon;
  }
}
