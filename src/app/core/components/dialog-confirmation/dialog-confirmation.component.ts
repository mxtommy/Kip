import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { DialogConfirmationData } from '../../interfaces/dialog-data';
import { AsyncPipe, NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'dialog-confirmation',
  standalone: true,
  imports: [MatIcon, MatDialogModule, MatButtonModule, NgComponentOutlet, AsyncPipe ],
  templateUrl: './dialog-confirmation.component.html',
  styleUrl: './dialog-confirmation.component.scss'
})
export class DialogConfirmationComponent {
  constructor(@Inject(MAT_DIALOG_DATA) protected data: DialogConfirmationData) {}
}
