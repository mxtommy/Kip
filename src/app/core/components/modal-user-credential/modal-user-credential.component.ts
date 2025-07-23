import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-modal-user-credential',
    templateUrl: './modal-user-credential.component.html',
    styleUrls: ['./modal-user-credential.component.scss'],
    imports: [FormsModule, MatDialogTitle, MatDialogContent, MatFormField, MatLabel, MatInput, MatError, MatDivider, MatDialogActions, MatButton, MatDialogClose]
})
export class ModalUserCredentialComponent {
  dialogRef = inject<MatDialogRef<ModalUserCredentialComponent>>(MatDialogRef);
  data = inject<{
    user: string;
    password: string;
    error: string;
}>(MAT_DIALOG_DATA);

  titleDialog = "Sign in to Signal K";

  protected saveCredential() {
    this.data.error = null;
    this.dialogRef.close(this.data);
  }

}
