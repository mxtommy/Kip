import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalkRequestsService } from '../../signalk-requests.service';
import { NotificationsService } from '../../notifications.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { IChildControl } from '../../widgets-interface';

@Component({
  selector: 'app-widget-boolean-switch',
  templateUrl: './widget-boolean-switch.component.html',
  styleUrls: ['./widget-boolean-switch.component.css']
})
export class WidgetBooleanSwitchComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnDestroy {

  public toggleControls: IChildControl[] = [];

  private skRequestSub = new Subscription; // Request result observer

  constructor(
    private signalkRequestsService: SignalkRequestsService,
    private notification: NotificationsService
    ) {
      super();

      this.defaultConfig = {
        displayName: 'Toggle Panel Label',
        filterSelfPaths: true,
        paths: {
          "Toggle Label 1": {
            description: "Boolean Data",
            path: "self.red.boolean1.state",
            source: "default",
            pathType: "boolean",
            isPathConfigurable: true,
            convertUnitTo: "unitless",
            sampleTime: 500
          },
          "Toggle Label 2": {
            description: "Boolean Data",
            path: "self.red.boolean2.state",
            source: "default",
            pathType: "boolean",
            isPathConfigurable: true,
            convertUnitTo: "unitless",
            sampleTime: 500
          }
        },
        enableTimeout: false,
        dataTimeout: 5,
        textColor: "text",
        putEnable: true,
        putMomentary: false,
        multiChildCtrls: [
          {
            label: "Toggle Label 1",
            pathKeyName: "Toggle Label 1",
            value: null,
            color: "text"
          },
          {
            label: "Toggle Label 2",
            pathKeyName: "Toggle Label 2",
            value: null,
            color: "accent"
          }
        ]
      };
  }

  ngOnInit(): void {
    this.validateConfig();
    // Build control array
    this.widgetProperties.config.multiChildCtrls.forEach(ctrlConfig => {
        this.toggleControls.push({...ctrlConfig});
      }
    );
    // Start Observers
    this.toggleControls.forEach(ctrl => {
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

  public toggle($event: IChildControl): void {
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
