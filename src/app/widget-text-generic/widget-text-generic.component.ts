import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';


const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "stringPath": {
      description: "String Data",
      path: null,
      source: null,
      pathType: "string",
    }
  },
  selfPaths: true
};

@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

    activeWidget: IWidget;
  
  dataValue: any = null;



  //subs
  valueSub: Subscription = null;

  
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
      this.activeWidget.config = defaultConfig; // load default config.
    }

    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (this.activeWidget.config.paths['stringPath'].path === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.activeWidget.config.paths['stringPath'].path, this.activeWidget.config.paths['stringPath'].source).subscribe(
      newValue => {
        this.dataValue = newValue;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.activeWidget.config.paths['stringPath'].path)
    }
  }

  openWidgetSettings(content) {
      
    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.activeWidget.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.activeWidget.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.activeWidget.config);
        this.subscribePath();
      }

    });
  }

}
