import { ViewChild, ElementRef, Component, OnInit, Input, AfterContentInit, AfterContentChecked, OnDestroy } from '@angular/core';
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
    "headingPath": {
      description: "Heading",
      path: 'self.navigation.courseOverGroundTrue',
      source: 'default',
      pathType: "number",
    },
    "trueWindAngle": {
      description: "True Wind Angle",
      path: 'self.environment.wind.angleTrueWater',
      source: 'default',
      pathType: "number",
    },
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

  gaugeType: 'ngRadial',
  gaugeTicks: false,
  radialSize: 'measuring',
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',     // theme palette to select
};


@Component({
  selector: 'app-widget-autopilot',
  templateUrl: './widget-autopilot.component.html',
  styleUrls: ['./widget-autopilot.component.scss']
})
export class WidgetAutopilotComponent implements OnInit, AfterContentInit, AfterContentChecked, OnDestroy {
  @ViewChild('autopilotScreen') private wrapper: ElementRef;
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  // hack to access material-theme palette colors
  @ViewChild('primary') private primaryElement: ElementRef;
  @ViewChild('accent') private accentElement: ElementRef;
  @ViewChild('warn') private warnElement: ElementRef;
  @ViewChild('primaryDark') private primaryDarkElement: ElementRef;
  @ViewChild('accentDark') private accentDarkElement: ElementRef;
  @ViewChild('warnDark') private warnDarkElement: ElementRef;
  @ViewChild('background') private backgroundElement: ElementRef;
  @ViewChild('text') private textElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  dataValue = 0;
  valueSub: Subscription = null;

  currentHeading: number = 0;
  headingSub: Subscription = null;

  trueWindAngle: number = null;
  trueWindAngleSub: Subscription = null;

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
    this.startAllSubscriptions();
  }

  ngAfterContentChecked() {
    this.resizeWidget();
  }

  ngAfterContentInit() {
  }

  ngOnDestroy() {
    this.stopAllSubscriptions();
  }

  startAllSubscriptions() {
    this.subscribePath(); // TODO(david): setup data paths
    this.subscribeHeading();
    this.subscribeTrueWindAngle();
  }

  stopAllSubscriptions() {
    this.unsubscribePath(); // TODO(david): setup data paths
    this.unsubscribeHeading();
    this.unsubscribeTrueWindAngle();

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

  subscribeHeading() {
    this.unsubscribeHeading();
    if (typeof(this.config.paths['headingPath'].path) != 'string') { return } // nothing to sub to...
    this.headingSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['headingPath'].path, this.config.paths['headingPath'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.currentHeading = 0;
        } else {
          this.currentHeading = this.UnitsService.convertUnit('deg', newValue);
        }

      }
    );
  }

  unsubscribeHeading() {
    if (this.headingSub !== null) {
      this.headingSub.unsubscribe();
      this.headingSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['headingPath'].path);
    }
  }

  subscribeTrueWindAngle() {
    this.unsubscribeTrueWindAngle();
    if (typeof(this.config.paths['trueWindAngle'].path) != 'string') { return } // nothing to sub to...

    this.trueWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['trueWindAngle'].path, this.config.paths['trueWindAngle'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.trueWindAngle = null;
          return;
        }

        let converted = this.UnitsService.convertUnit('deg', newValue);

        // Depending on path, this number can either be the magnetic compass heading, true compass heading, or heading relative to boat heading (-180 to 180deg)... Ugh...
          // 0-180+ for stb
          // -0 to -180 for port
          // need in 0-360

        if (this.config.paths['trueWindAngle'].path.match('angleTrueWater')||
        this.config.paths['trueWindAngle'].path.match('angleTrueGround')) {
          //-180 to 180
          this.trueWindAngle = this.addHeading(this.currentHeading, converted);
        } else if (this.config.paths['trueWindAngle'].path.match('direction')) {
          //0-360
          this.trueWindAngle = converted;
        }
      }
    );
  }

  unsubscribeTrueWindAngle() {
    if (this.trueWindAngleSub !== null) {
      this.trueWindAngleSub.unsubscribe();
      this.trueWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['trueWindAngle'].path);
    }
  }

  resizeWidget() {
    const rect = this.wrapper.nativeElement.getBoundingClientRect();

    if ((this.gaugeWidth != rect.width) || (this.gaugeHeight != rect.height)) {
      if (!this.isInResizeWindow) {
        this.isInResizeWindow = true;
          // this.gaugeOptions.height = rect.height;
          // this.gaugeOptions.width = rect.width;
          this.isInResizeWindow = false;
      }
    }
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
        this.stopAllSubscriptions();
        this.unsubscribePath();  //unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
        this.startAllSubscriptions();
      }
    });
  }

  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

}
