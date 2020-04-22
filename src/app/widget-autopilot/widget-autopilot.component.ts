import { ViewChild, ElementRef, Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';

const defaultConfig: IWidgetConfig = {
  widgetLabel: 'N2k Autopilot',
  paths: {
    "gaugePath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
    }
  },
  units: {
    "gaugePath": "unitless"
  },
  selfPaths: true,
};


@Component({
  selector: 'app-widget-autopilot',
  templateUrl: './widget-autopilot.component.html',
  styleUrls: ['./widget-autopilot.component.scss']
})
export class WidgetAutopilotComponent implements OnInit {
  @ViewChild('autopilot') private wrapper: ElementRef;
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  activeWidget: IWidget;
  config: IWidgetConfig;

  dataValue = 0;
  valueSub: Subscription = null;

  gaugeHeight = 0;
  gaugeWidth = 0;

  isInResizeWindow = false;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
  ) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribePath(); // TODO(david): setup data paths
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
          this.dataValue = this.UnitsService.convertUnit(this.config.units['gaugePath'], newValue);
        }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['gaugePath'].path)
    }
  }


  resizeWidget() {
    const rect = this.wrapper.nativeElement.getBoundingClientRect();

    if ((this.gaugeWidth != rect.width) || (this.gaugeHeight != rect.height)) {
      if (!this.isInResizeWindow) {
        this.isInResizeWindow = true;
          this.gaugeHeight = rect.height;
          this.gaugeWidth = rect.width;
          this.isInResizeWindow = false;
      }
    }
  }

}
