import { Component, Inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
  selector: 'app-modal-user-credential',
  templateUrl: './modal-user-credential.component.html',
  styleUrls: ['./modal-user-credential.component.scss']
})
export class ModalUserCredentialComponent implements OnInit {
  titleDialog: string = "Sign in to Signal K";

  constructor(
    public dialogRef: MatDialogRef<ModalUserCredentialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {user: string, password: string, error: string}
  ) { }


  ngOnInit(): void {
  }

  SaveCredential() {
    this.data.error = null;
    this.dialogRef.close(this.data);
  }

}
