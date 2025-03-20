import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-modal-user-credential',
    templateUrl: './modal-user-credential.component.html',
    styleUrls: ['./modal-user-credential.component.scss'],
    standalone: true,
    imports: [FormsModule, MatDialogTitle, MatDialogContent, NgIf, MatFormField, MatLabel, MatInput, MatError, MatDivider, MatDialogActions, MatButton, MatDialogClose]
})
export class ModalUserCredentialComponent {
  titleDialog: string = "Sign in to Signal K";

  constructor(
    public dialogRef: MatDialogRef<ModalUserCredentialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {user: string, password: string, error: string}
  ) { }

  protected saveCredential() {
    this.data.error = null;
    this.dialogRef.close(this.data);
  }

}
