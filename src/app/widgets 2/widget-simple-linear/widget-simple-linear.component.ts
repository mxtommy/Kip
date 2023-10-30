import { ViewChild, Input, ElementRef, Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';

const defaultConfig: IWidgetSvcConfig = {
  displayName: "Display Name",
  filterSelfPaths: true,
  paths: {
    "gaugePath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "v"
    }
  },
  minValue: 0,
  maxValue: 14.4,
  numInt: 1,
  numDecimal: 2,
  gaugeType: "simpleLinear", // Applied to Units label. abr = first letter only. full = full string
  gaugeUnitLabelFormat: "full", // Applied to Units label. abr = first letter only. full = full string
  barColor: 'accent',
};

@Component({
  selector: 'app-widget-simple-linear',
  templateUrl: './widget-simple-linear.component.html',
  styleUrls: ['./widget-simple-linear.component.scss']
})
export class WidgetSimpleLinearComponent implements OnInit, OnDestroy {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  @ViewChild('primary', {static: true, read: ElementRef}) private primaryElement: ElementRef;
  @ViewChild('accent', {static: true, read: ElementRef}) private accentElement: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warnElement: ElementRef;
  @ViewChild('primaryDark', {static: true, read: ElementRef}) private primaryDarkElement: ElementRef;
  @ViewChild('accentDark', {static: true, read: ElementRef}) private accentDarkElement: ElementRef;
  @ViewChild('warnDark', {static: true, read: ElementRef}) private warnDarkElement: ElementRef;
  @ViewChild('background', {static: true, read: ElementRef}) private backgroundElement: ElementRef;
  @ViewChild('text', {static: true, read: ElementRef}) private textElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetSvcConfig;

  public unitsLabel:string = "";
  public dataValue: string = "0";
  public gaugeValue: Number = 0;
  public barColor: string = "";
  public barColorGradient: string = "";
  public barColorBackground: string = "";

  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  constructor(
    public dialog:MatDialog,
    private signalKService: SignalKService,
    private widgetManagerService: WidgetManagerService,
    private unitsService: UnitsService,
    private appSettingsService: AppSettingsService, // need for theme change subscription
  ) { }

  ngOnInit(): void {
    this.activeWidget = this.widgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.widgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.updateGaugeSettings();
    this.subscribePath();
    this.subscribeTheme();
  }

  updateGaugeSettings() {
    this.barColorBackground = window.getComputedStyle(this.backgroundElement.nativeElement).color;

    switch (this.config.barColor) {
      case "primary":
        this.barColor = getComputedStyle(this.primaryElement.nativeElement).color;
        this.barColorGradient = getComputedStyle(this.primaryDarkElement.nativeElement).color;
        break;

      case "accent":
        this.barColor = getComputedStyle(this.accentElement.nativeElement).color;
        this.barColorGradient = getComputedStyle(this.accentDarkElement.nativeElement).color;
        break;

      case "warn":
        this.barColor = getComputedStyle(this.warnElement.nativeElement).color;
        this.barColorGradient = getComputedStyle(this.warnDarkElement.nativeElement).color;
        break;
    }
  }

  subscribePath() {
    this.unsubscribePath();

    // set Units label sting based on gauge config
    if (this.config.gaugeUnitLabelFormat == "abr") {
      this.unitsLabel = this.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.config.paths['gaugePath'].convertUnitTo;
    }

    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.signalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        if (newValue.value == null) {return}

        // convert to unit and format value using widget settings
        let value  = this.unitsService.convertUnit(this.config.paths['gaugePath'].convertUnitTo, newValue.value).toFixed(this.config.numDecimal);

        // Format display value using widget settings
        let displayValue = value;
        if (this.config.numDecimal != 0){
          this.dataValue = displayValue.padStart((this.config.numInt + this.config.numDecimal + 1), "0");
        } else {
          this.dataValue = displayValue.padStart(this.config.numInt, "0");
        }

        // Format value for gauge bar
        let gaugeValue = Number(value);

        // Limit gauge bar animation overflow to gauge settings
        if (gaugeValue >= this.config.maxValue) {
          this.gaugeValue = this.config.maxValue;
        } else if (gaugeValue <= this.config.minValue) {
          this.gaugeValue = this.config.minValue;
        } else {
          this.gaugeValue = gaugeValue;
        }
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.signalKService.unsubscribePath(this.widgetUUID, this.config.paths['gaugePath'].path)
    }
  }

  // Subscribe to theme event
  subscribeTheme() {
  this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
    themeChange => {
      setTimeout(() => {   // delay so browser getComputedStyles has time to complete theme style change.
        this.updateGaugeSettings();
      }, 50);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
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
          this.updateGaugeSettings();
          this.widgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
          this.subscribePath();
        }
      });
    }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
  }

}
