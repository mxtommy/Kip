import { Component, OnInit, OnChanges, OnDestroy, AfterViewChecked, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalkRequestsService } from '../../signalk-requests.service';
import { NotificationsService } from '../../notifications.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-boolean-toggle',
  templateUrl: './widget-boolean-toggle.component.html',
  styleUrls: ['./widget-boolean-toggle.component.css']
})
export class WidgetBooleanToggleComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnDestroy {

  public state: boolean = null;
  skRequestSub = new Subscription; // Request result observer

  constructor(
    private signalkRequestsService: SignalkRequestsService,
    private notification: NotificationsService
    ) {
      super();

      this.defaultConfig = {
        displayName: 'Toggle Label',
        filterSelfPaths: true,
        paths: {
          "boolPath": {
            description: "Boolean Data",
            path: null,
            source: null,
            pathType: "boolean",
            isPathConfigurable: true,
            convertUnitTo: "unitless",
            sampleTime: 500
          }
        },
        putEnable: false,
        putMomentary: false,
        putMomentaryValue: true,
        barColor: 'accent',
        enableTimeout: false,
        dataTimeout: 5
      };
  }

  ngOnInit(): void {
    this.validateConfig();

    this.observeDataStream('boolPath', newValue => {
      this.state = newValue.value;
      }
    );
    this.subscribeSKRequest();
  }

  private subscribeSKRequest() {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        let errMsg = `Button ${this.widgetProperties.config.displayName}: `;
        if (requestResult.statusCode != 200){
          if (requestResult.message){
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + " - " +requestResult.statusCodeDescription;
          }
          this.notification.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  private unsubscribeSKRequest() {
    this.skRequestSub.unsubscribe();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.unsubscribeSKRequest();
  }
}


