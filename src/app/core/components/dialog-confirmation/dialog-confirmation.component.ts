import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { DialogConfirmationData } from '../../interfaces/dialog-data';

@Component({
  selector: 'dialog-confirmation',
  standalone: true,
  imports: [ MatIcon, MatDialogModule, MatButtonModule ],
  templateUrl: './dialog-confirmation.component.html',
  styleUrl: './dialog-confirmation.component.scss'
})
export class DialogConfirmationComponent {
  protected data = inject<DialogConfirmationData>(MAT_DIALOG_DATA);
}
