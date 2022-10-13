import { Observable } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from "@angular/router";
import { AuththeticationService } from "../auththetication.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {

  username: string = null;
  password: string = null;
  private loginSub = null;

  constructor(
    private router: Router,
    private auth: AuththeticationService
  ) { }

  ngOnInit(): void {
  }

  submitForm() {
    /* this.loginSub = this.auth
      .login(this.username, this.password)
      .subscribe(
        loginResponse => {
        //TODO: route to appropriate page
        this.router.navigate(['/page', 0]);

      },
      error => {
        let errResponse:HttpErrorResponse = error;
        if (errResponse.status == 401) {
          console.log("[Login Component] Login failure: " + errResponse.statusText);
        } else if (errResponse.status == 404) {
          console.log("[Login Component] Login failure: " + errResponse.message);
        } else if (errResponse.status == 0) {
          console.log("[Login Component] " + errResponse.message);
        } else {
          console.log("[Login Component] Unknown login error response: " + JSON.stringify(error));
        }
      }
    ); */
  }

  ngOnDestroy(): void {
    if (this.loginSub)
    this.loginSub.unsubscribe();
  }
}
