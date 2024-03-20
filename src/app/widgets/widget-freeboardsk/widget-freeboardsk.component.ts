import { AuthenticationService } from './../../core/services/authentication.service';
import { AppSettingsService } from './../../core/services/app-settings.service';
import { Component, OnInit } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { SafePipe } from "../../core/pipes/safe.pipe";

@Component({
    selector: 'app-widget-freeboardsk',
    standalone: true,
    templateUrl: './widget-freeboardsk.component.html',
    styleUrl: './widget-freeboardsk.component.scss',
    imports: [SafePipe]
})
export class WidgetFreeboardskComponent extends BaseWidgetComponent implements OnInit {
  public widgetUrl: string = null;

  constructor(private appSettings: AppSettingsService, private auth: AuthenticationService) {
    super();

    this.defaultConfig = {
      widgetUrl: null
    };
  }

  ngOnInit(): void {
    this.validateConfig();

    let token: string = null;
    this.auth.authToken$.subscribe(AuthServiceToken => {
      token = AuthServiceToken.token;
    });

    this.widgetUrl = `${this.appSettings.signalkUrl.url}/@signalk/freeboard-sk/?token=${token}`;
    console.log(this.widgetUrl);
  }
}
