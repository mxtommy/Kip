import { AuthenticationService } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { SafePipe } from "../../core/pipes/safe.pipe";
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-widget-freeboardsk',
    standalone: true,
    templateUrl: './widget-freeboardsk.component.html',
    styleUrl: './widget-freeboardsk.component.scss',
    imports: [SafePipe]
})
export class WidgetFreeboardskComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  public widgetUrl: string = null;
  private authTokenSubscription: Subscription = null;

  constructor(private appSettings: AppSettingsService, private auth: AuthenticationService) {
    super();
  }

  ngOnInit(): void {
    let loginToken: string = null;
    this.authTokenSubscription = this.auth.authToken$.subscribe(AuthServiceToken => {
        loginToken = AuthServiceToken?.token;
      }
    );

    this.widgetUrl = loginToken ? `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/?token=${loginToken}` : `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/`;
  }

  ngOnDestroy(): void {
    this.authTokenSubscription?.unsubscribe();
  }
}
