import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { IConnectionConfig } from '../app-init.interfaces';

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
