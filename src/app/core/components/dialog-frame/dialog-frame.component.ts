import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { DialogComponentData } from '../../interfaces/dialog-data';
import { NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'dialog-frame',
  standalone: true,
  imports: [MatIcon, MatDialogModule, MatButtonModule, NgComponentOutlet ],
  templateUrl: './dialog-frame.component.html',
  styleUrl: './dialog-frame.component.scss'
})
export class DialogFrameComponent {
  protected data = inject<DialogComponentData>(MAT_DIALOG_DATA);

}
