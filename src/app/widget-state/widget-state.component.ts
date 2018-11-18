import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';


const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "boolPath": {
      description: "Boolean Data",
      path: null,
      source: null,
      pathType: "boolean",
    }
  },
  selfPaths: true
};


@Component({
  selector: 'app-widget-state',
  templateUrl: './widget-state.component.html',
  styleUrls: ['./widget-state.component.css']
})
export class WidgetStateComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  valueSub: Subscription = null;
  activeWidget: IWidget;
  config: IWidgetConfig;

  state: boolean = null;


  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService) {
  }

  ngOnInit() {
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
    if (typeof(this.config.paths['boolPath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['boolPath'].path, this.config.paths['boolPath'].source).subscribe(
      newValue => {
        this.state = newValue;
      }
    );
  }



  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['boolPath'].path)
    }
  }

  openWidgetSettings(content) {
      
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
