import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuththeticationService } from "../auththetication.service";
import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';
import { ModalUserCredentialComponent } from '../modal-user-credential/modal-user-credential.component';
import { IConnectionConfig } from "../app-settings.interfaces";
import { HttpErrorResponse } from '@angular/common/http';


@Component({
  selector: 'app-widget-login',
  templateUrl: './widget-login.component.html',
  styleUrls: ['./widget-login.component.css']
})
export class WidgetLoginComponent implements OnInit {
  public connectionConfig: IConnectionConfig = null;

  constructor(
    public dialog: MatDialog,
    private auth: AuththeticationService,
    private notificationsService: NotificationsService,
    private appSettingsService: AppSettingsService,
  ) { }

  ngOnInit(): void {
    this.connectionConfig = this.appSettingsService.getConnectionConfig();
    this.openUserCredentialModal("Sign in failed: Incorrect user/password. Enter valide credentials or access the Confifuration/Settings menu, validate the server URL or/and disable the user Sign in option");
  }

  public openUserCredentialModal(errorMsg: string) {
    let dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      disableClose: true,
      data: {
        user: this.connectionConfig.loginName,
        password: this.connectionConfig.loginPassword,
        error: errorMsg
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data === undefined || !data) {
        return; //clicked Cancel or navigated await from page using url bar.
      } else {
        this.connectionConfig.loginName = data.user;
        this.connectionConfig.loginPassword = data.password;
        this.appSettingsService.setConnectionConfig(this.connectionConfig);
        this.serverLogin();
      }
    });
  }

  private serverLogin(newUrl?: string) {
    this.auth.login({ usr: this.connectionConfig.loginName, pwd: this.connectionConfig.loginPassword, newUrl })
    .then( _ => {
      this.appSettingsService.reloadApp();
    })
    .catch((error: HttpErrorResponse) => {
      if (error.status == 401) {
        this.openUserCredentialModal("Sign in failed: Invalide user/password. Enter valide credentials");
        console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
      } else if (error.status == 404) {
        this.notificationsService.sendSnackbarNotification("Sign in failed: Login API not found at URL. See connection detail status in Configuration/Settings", 5000, false);
        console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
      } else if (error.status == 0) {
        this.notificationsService.sendSnackbarNotification("Sign in failed: Cannot reach server at Signal K URL. See connection detail status in Configuration/Settings", 5000, false);
        console.log("[Setting-SignalK Component] Sign in failed: Cannot reach server at Signal K URL:" + error.message);
      } else {
        this.notificationsService.sendSnackbarNotification("Unknown authentication failure: " + JSON.stringify(error), 5000, false);
        console.log("[Setting-SignalK Component] Unknown login error response: " + JSON.stringify(error));
      }
    });
  }
}
