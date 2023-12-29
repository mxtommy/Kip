import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalkRequestsService } from '../../signalk-requests.service';
import { NotificationsService } from '../../notifications.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { IDynamicControl } from '../../widgets-interface';

@Component({
  selector: 'app-widget-boolean-switch',
  templateUrl: './widget-boolean-switch.component.html',
  styleUrls: ['./widget-boolean-switch.component.css']
})
export class WidgetBooleanSwitchComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnDestroy {

  public switchControls: IDynamicControl[] = [];

  private skRequestSub = new Subscription; // Request result observer

  constructor(
    private signalkRequestsService: SignalkRequestsService,
    private notification: NotificationsService
    ) {
      super();

      this.defaultConfig = {
        displayName: 'Switch Panel Label',
        filterSelfPaths: true,
        paths: {},
        enableTimeout: false,
        dataTimeout: 5,
        textColor: "text",
        putEnable: true,
        putMomentary: false,
        multiChildCtrls: []
      };
  }

  ngOnInit(): void {
    this.validateConfig();
    // Build control array
    this.widgetProperties.config.multiChildCtrls.forEach(ctrlConfig => {
        this.switchControls.push({...ctrlConfig});
      }
    );
    // Start Observers
    this.switchControls.forEach(ctrl => {
        this.observeDataStream(ctrl.pathKeyName, newValue => {
            ctrl.value = newValue.value;
          }
        );
      }
    );
    // Listen to PUT response msg
    this.subscribeSKRequest();
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        let errMsg = `Toggle Widget ${this.widgetProperties.config.displayName}: `;
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

  public toggle($event: IDynamicControl): void {
    this.signalkRequestsService.putRequest(
      this.widgetProperties.config.paths[$event.pathKeyName].path,
      $event.value,
      this.widgetProperties.uuid
    );
  }

  ngOnDestroy(): void {
    this.unsubscribeDataStream();
    this.skRequestSub?.unsubscribe();
  }
}
