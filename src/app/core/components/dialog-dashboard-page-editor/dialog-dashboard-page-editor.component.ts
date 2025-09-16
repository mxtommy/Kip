import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { DialogDashboardPageEditorData } from '../../interfaces/dialog-data';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { SelectIconComponent } from '../select-icon/select-icon.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AppSettingsService } from '../../services/app-settings.service';

@Component({
  selector: 'dialog-dashboard-page-editor',
  standalone: true,
  imports: [ MatDialogModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule, SelectIconComponent, MatCheckboxModule ],
  templateUrl: './dialog-dashboard-page-editor.component.html',
  styleUrl: './dialog-dashboard-page-editor.component.scss'
})
export class DialogDashboardPageEditorComponent {
  protected dialogRef = inject<MatDialogRef<DialogDashboardPageEditorComponent>>(MatDialogRef);
  protected data = inject<DialogDashboardPageEditorData>(MAT_DIALOG_DATA);
  private _settings = inject(AppSettingsService);
  protected isSplitShellEnabled = signal<boolean>(true);

  constructor() {
    // Set default icon if not provided
    if (!this.data.icon) {
      this.data.icon = 'dashboard-dashboard';
    }
    this.isSplitShellEnabled.set(this._settings.getSplitShellEnabled());
  }

  protected save(): void {
    this.dialogRef.close(this.data);
  }

  protected onIconSelected(icon: string): void {
    this.data.icon = icon;
  }
}
