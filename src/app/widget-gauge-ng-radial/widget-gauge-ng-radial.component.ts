import { ViewChild, ElementRef, Component, OnInit, AfterContentChecked, AfterViewInit, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { RadialGauge, RadialGaugeOptions } from 'ng-canvas-gauges';

const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
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

  gaugeType: 'ngRadial',  //ngLinearVertical or ngLinearHorizontal
  gaugeTicks: false,
  minValue: 0,
  maxValue: 100,
  barColor: 'accent',
};

@Component({
  selector: 'app-widget-gauge-ng-radial',
  templateUrl: './widget-gauge-ng-radial.component.html',
  styleUrls: ['./widget-gauge-ng-radial.component.scss']
})
export class WidgetGaugeNgRadialComponent implements OnInit {

  @ViewChild('wrapperDiv') wrapper: ElementRef;
  @ViewChild('radialGauge') public radialGauge: RadialGauge;

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  @ViewChild('primary') primaryElement: ElementRef;
  @ViewChild('accent') accentElement: ElementRef;
  @ViewChild('warn') warnElement: ElementRef;
  @ViewChild('background') backgroundElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  public dataValue = 0;
  valueSub: Subscription = null;

  themePrimaryColor: string;
  themeAccentColor: string;
  themeWarnColor: string;
  themeBackgroundColor: string;

  public gaugeOptions = {} as RadialGaugeOptions;

  gaugeColorTexts: string = "";
  gaugeColorPlate: string = "";
  gaugeBarColor: string = "";
  gaugeBarBackgroundColor: string = "";
  gaugeHeight: number = 300;
  gaugeWidth: number = 100;

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
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }

  ngAfterViewInit() {
    this.updateGaugeConfig();
  }

  ngAfterContentInit(){

   }

  ngAfterContentChecked() {
    this.resizeWidget();

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

  openWidgetSettings() {
    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();  //unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();

        this.updateGaugeConfig();
      }
    });
  }

  updateGaugeConfig(){
    ////  Colors
    // Hack to get Theme colors using hidden minxin, DIV and @ViewChild
    this.themePrimaryColor = getComputedStyle(this.primaryElement.nativeElement).color;
    this.themeAccentColor = getComputedStyle(this.accentElement.nativeElement).color;
    this.themeWarnColor = getComputedStyle(this.warnElement.nativeElement).color;
    this.themeBackgroundColor = getComputedStyle(this.backgroundElement.nativeElement).color;

    // Labels - match selected theme
    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = window.getComputedStyle(this.wrapper.nativeElement).color;

    // Faceplate and gauge bar background - match selected theme
    this.gaugeColorPlate = window.getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeBarBackgroundColor = this.themeBackgroundColor;

    ///////////////////////////////////////
    //Set layout selection specific values

    // this.gaugeOptions.fontUnitsSize = 50;
    // this.gaugeOptions.fontTitleSize = 35;

    if (this.config.gaugeTicks == true) {
      // this.gaugeOptions.barWidth = 50;
      this.gaugeOptions.majorTicks = [0,100];
      this.gaugeOptions.majorTicksInt = 1;
      this.gaugeOptions.colorMajorTicks = "red";
      this.gaugeOptions.minorTicks = 10;
      this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;
      this.gaugeOptions.numbersMargin = -20;
      this.gaugeOptions.fontNumbersSize = 25;
      this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;
    }
    else {
      // this.gaugeOptions.barWidth = 95;

      this.gaugeOptions.majorTicks = [];
      this.gaugeOptions.majorTicksInt = 0;
      this.gaugeOptions.colorMajorTicks = "";
      this.gaugeOptions.minorTicks = 0;
      this.gaugeOptions.colorMinorTicks = "";
      this.gaugeOptions.numbersMargin = 0;
      this.gaugeOptions.fontNumbersSize = 0;
    }

    switch (this.config.barColor) {
      case "primary":
        this.gaugeBarColor = this.themePrimaryColor;
        break;

      case "accent":
        this.gaugeBarColor = this.themeAccentColor;
        break;

      case "warn":
        this.gaugeBarColor = this.themeWarnColor;
        break;

      case "special":
        this.gaugeBarColor = "red";
        break;

      default:
        break;
    }
  }

  resizeWidget() {
    let rect = this.wrapper.nativeElement.getBoundingClientRect();

    this.gaugeOptions.height = Math.floor(rect.height * 0.88);
    this.gaugeOptions.width = Math.floor(rect.width * 0.88);
  }
}
