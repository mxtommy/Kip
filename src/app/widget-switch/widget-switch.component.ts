import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService, pathObject } from '../signalk.service';
import { SignalKConnectionService } from '../signalk-connection.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';


const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "statePath": {
      description: "State Data",
      path: null,
      source: null,
      pathType: "boolean",
    }
  },
  selfPaths: true,
};



@Component({
  selector: 'app-widget-switch',
  templateUrl: './widget-switch.component.html',
  styleUrls: ['./widget-switch.component.css']
})
export class WidgetSwitchComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  activeWidget: IWidget;
  config: IWidgetConfig;
  
  dataValue: number = null;
  dataTimestamp: number = Date.now();
  valueSub: Subscription = null;

  state: boolean = null;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private SignalKConnectionService: SignalKConnectionService,
    private WidgetManagerService: WidgetManagerService) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['statePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['numericPath'].path, this.config.paths['numericPath'].source).subscribe(
      newValue => {
        this.state = newValue;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['statePath'].path);
    }
  }


  sendDelta(value: boolean) {
    this.SignalKConnectionService.publishDelta("putPath.test1", value);
  }



  openWidgetSettings() {

    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
      }

    });

  }








}
