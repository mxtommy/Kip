import { Component, OnInit, inject } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthenticationService } from "../../core/services/authentication.service";
import { SettingsService } from '../../core/services/settings.service';
import { ModalUserCredentialComponent } from '../../core/components/modal-user-credential/modal-user-credential.component';
import { IConnectionConfig } from "../../core/interfaces/app-settings.interfaces";
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';


@Component({
  selector: 'app-widget-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './widget-login.component.html',
  styleUrls: ['./widget-login.component.css']
})
export class WidgetLoginComponent implements OnInit {
  dialog = inject(MatDialog);
  private auth = inject(AuthenticationService);
  private toast = inject(ToastService);
  private settings = inject(SettingsService);

  public connectionConfig: IConnectionConfig | null = null;

  ngOnInit(): void {
    this.connectionConfig = this.settings.getConnectionConfig();
    this.openUserCredentialModal("Sign in failed: Incorrect user/password. Enter valide credentials or access the Confifuration/Settings menu, validate the server URL or/and disable the user Sign in option");
  }

  public openUserCredentialModal(errorMsg: string) {
    const connectionConfig = this.connectionConfig;
    if (!connectionConfig) {
      return;
    }

    const dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      disableClose: true,
      data: {
        user: connectionConfig.loginName,
        password: connectionConfig.loginPassword,
        error: errorMsg
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data === undefined || !data) {
        return; //clicked Cancel or navigated await from page using url bar.
      } else {
        connectionConfig.loginName = data.user;
        connectionConfig.loginPassword = data.password;
        this.settings.setConnectionConfig(connectionConfig);
        this.serverLogin();
      }
    });
  }

  private serverLogin(newUrl?: string) {
    const connectionConfig = this.connectionConfig;
    if (!connectionConfig) {
      return;
    }

    this.auth.login({ usr: connectionConfig.loginName, pwd: connectionConfig.loginPassword, newUrl })
    .then(() => {
      this.settings.reloadApp();
    })
    .catch((error: HttpErrorResponse) => {
      if (error.status == 401) {
        this.openUserCredentialModal("Sign in failed: Invalide user/password. Enter valide credentials");
        console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
      } else if (error.status == 404) {
        this.toast.show("Login API not found at URL. See connection detail status in Configuration/Settings", 5000, false, 'error');
        console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
      } else if (error.status == 0) {
        this.toast.show("Cannot reach server at Signal K URL. See connection detail status in Configuration/Settings", 5000, false, 'error');
        console.log("[Setting-SignalK Component] Sign in failed: Cannot reach server at Signal K URL:" + error.message);
      } else {
        this.toast.show("Unknown authentication failure: " + JSON.stringify(error), 5000, false, 'error');
        console.log("[Setting-SignalK Component] Unknown login error response: " + JSON.stringify(error));
      }
    });
  }
}
