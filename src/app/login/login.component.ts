import { SignalKConnectionService } from './../signalk-connection.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from "@angular/router";
import { AuththeticationService } from "../auththetication.service";
import { AppSettingsService } from './../app-settings.service';
import { NotificationsService } from './../notifications.service';
import { IConnectionConfig } from "./../app-settings.interfaces";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  private loginSub = null;
  public connectionConfig: IConnectionConfig = null;

  constructor(
    private router: Router,
    private auth: AuththeticationService,
    private notificationsService: NotificationsService,
    private appSettingsService: AppSettingsService,
    private skConnectionService: SignalKConnectionService,
  ) { }

  ngOnInit(): void {
    this.connectionConfig = this.appSettingsService.getConnectionConfig();
  }

  submitForm() {
    this.auth.login({ usr: this.connectionConfig.loginName, pwd: this.connectionConfig.loginPassword })
      .then( () => {
        let connection = {url: this.connectionConfig.signalKUrl, new: false};
        this.skConnectionService.resetSignalK(connection);
        this.appSettingsService.signalkUrl = connection;
        this.appSettingsService.setConnectionConfig(this.connectionConfig);
        this.router.navigate(['/page', 0]);
      })
      .catch((error: HttpErrorResponse) => {
        if (error.status == 401) {
          this.notificationsService.sendSnackbarNotification("Authentication failed. Invalide user/password", 2000, false);
          console.log("[Login Component] Login failure: " + error.statusText);
        } else if (error.status == 404) {
          this.notificationsService.sendSnackbarNotification("Authentication failed. Login API not found", 2000, false);
          console.log("[Login Component] Login failure: " + error.message);
        } else if (error.status == 0) {
          this.notificationsService.sendSnackbarNotification("User authentication failed. Cannot reach server at SignalK URL", 2000, false);
          console.log("[Login Component] " + error.message);
        } else {
          this.notificationsService.sendSnackbarNotification("Unknown authentication failure: " + JSON.stringify(error), 2000, false);
          console.log("[Login Component] Unknown login error response: " + JSON.stringify(error));
        }
      });
  }

  ngOnDestroy(): void {
    if (this.loginSub)
    this.loginSub.unsubscribe();
  }
}
