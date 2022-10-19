import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IConnectionConfig } from '../app-settings.interfaces';

@Component({
  selector: 'app-modal-user-credential',
  templateUrl: './modal-user-credential.component.html',
  styleUrls: ['./modal-user-credential.component.css']
})
export class ModalUserCredentialComponent implements OnInit {
  titleDialog: string = "User Credential";

  constructor(
    public dialogRef: MatDialogRef<ModalUserCredentialComponent>,
    @Inject(MAT_DIALOG_DATA) public connectionConfig: IConnectionConfig
  ) { }


  ngOnInit(): void {
  }

  SaveCredential() {
    this.dialogRef.close(this.connectionConfig);
  }

}
