import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { DialogComponentData } from '../../interfaces/dialog-data';
import { AsyncPipe, NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'dialog-frame',
  standalone: true,
  imports: [MatIcon, MatDialogModule, MatButtonModule, NgComponentOutlet, AsyncPipe ],
  templateUrl: './dialog-frame.component.html',
  styleUrl: './dialog-frame.component.scss'
})
export class DialogFrameComponent {
  constructor(@Inject(MAT_DIALOG_DATA) protected data: DialogComponentData) {}

}
