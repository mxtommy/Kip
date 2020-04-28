import { ViewChild, Input, ElementRef, Component, HostBinding, OnInit, AfterContentInit, AfterContentChecked, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog, MatButton } from '@angular/material';
import { ResizedEvent } from 'angular-resize-event';
import { trigger, state, style, animate, transition } from '@angular/animations';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';


const defaultConfig: IWidgetConfig = {
  widgetLabel: 'N2k Autopilot',
  paths: {
    "headingMagPath": {
      description: "Heading Magnetic",
      path: 'self.navigation.courseOverGroundMagnetic',
      source: 'default',
      pathType: "number",
    },
    "appWindAngle": {
      description: "Apparent Wind Angle",
      path: 'self.environment.wind.angleApparent',
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

const commands = {
  "auto":    {"path":"steering.autopilot.state","value":"auto"},
  "wind":    {"path":"steering.autopilot.state","value":"wind"},
  "route":   {"path":"steering.autopilot.state","value":"route"},
  "standby": {"path":"steering.autopilot.state","value":"standby"},
  "+1":      {"path":"steering.autopilot.actions.adjustHeading","value":1},
  "+10":     {"path":"steering.autopilot.actions.adjustHeading","value":10},
  "-1":      {"path":"steering.autopilot.actions.adjustHeading","value":-1},
  "-10":     {"path":"steering.autopilot.actions.adjustHeading","value":-10},
  "tackToPort":   {"path":"steering.autopilot.actions.tack","value":"port"},
  "tackToStarboard":   {"path":"steering.autopilot.actions.tack","value":"starboard"},
  "advanceWaypoint":   {"path":"steering.autopilot.actions.advanceWaypoint","value":"1"}
};

const countDownDefault: number = 5;


@Component({
  selector: 'app-widget-autopilot',
  templateUrl: './widget-autopilot.component.html',
  styleUrls: ['./widget-autopilot.component.scss'],
  animations: [
    trigger('fadeInOut', [

      state('connected', style({
        opacity: 0,
      })),
      state('disconnected', style({
        opacity: 1,
      })),
      transition('connected => disconnected', [
        animate('0.5s')
      ]),
      transition('disconnected => connected', [
        animate('0.5s')
      ]),
    ]),
  ]
})
export class WidgetAutopilotComponent implements OnInit, AfterContentInit, AfterContentChecked, OnDestroy {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  // AP screen
  @ViewChild('apStencil') ApStencil: ElementRef;
  @ViewChild('countDown') countDown: ElementRef;

  @ViewChild('apStencilConfirmCommand') apStencilConfirmCommand: ElementRef;
  // AP keypad
  @ViewChild('powerBtn') powerBtn: MatButton;
  @ViewChild('stbTackBtn') stbTackBtn: MatButton;
  @ViewChild('plus1Btn') plus1Btn: MatButton;
  @ViewChild('minus1Btn') minus1Btn: MatButton;
  @ViewChild('prtTackBtn') prtTackBtn: MatButton;
  @ViewChild('standbyBtn') standbyBtn: MatButton;
  @ViewChild('plus10Btn') plus10Btn: MatButton;
  @ViewChild('minus10Btn') minus10Btn: MatButton;
  @ViewChild('autoBtn') autoBtn: MatButton;
  @ViewChild('windModeBtn') windModeBtn: MatButton;
  @ViewChild('trackModeBtn') trackModeBtn: MatButton;
  @ViewChild('nxtWpBtn') nxtWpBtn: MatButton;
  @ViewChild('muteBtn') muteBtn: MatButton;
  @ViewChild('messageBtn') messageBtn: MatButton;

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

  appWindAngle: number = null;
  appWindAngleSub: Subscription = null;

  maxWidth = 0;

  isApConnected: boolean = false;

  handleCountDownCounterTimeout = null;
  handleConfirmActionTimeout = null;
  countDownValue: number = 0;
  actionToBeConfirmed: string = "";
  pilotStatus: string = "";

  // cmdConfirmed: boolean = false;

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
  }

  ngAfterContentChecked() {

  }

  ngAfterContentInit() {
  }

  ngOnDestroy() {
    this.stopAllSubscriptions();
  }

  startAllSubscriptions() {
    this.subscribePath(); // TODO(david): setup data paths
    this.subscribeHeading();
    this.subscribeAppWindAngle();
    console.log("Autopilot Sub Started");
  }

  stopAllSubscriptions() {
    this.unsubscribePath(); // TODO(david): setup data paths
    this.unsubscribeHeading();
    this.unsubscribeAppWindAngle();
    console.log("Autopilot Sub Stopped");
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
    if (typeof(this.config.paths['headingMagPath'].path) != 'string') { return } // nothing to sub to...
    this.headingSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['headingMagPath'].path, this.config.paths['headingMagPath'].source).subscribe(
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
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['headingMagPath'].path);
    }
  }

  subscribeAppWindAngle() {
    this.unsubscribeAppWindAngle();
    if (typeof(this.config.paths['appWindAngle'].path) != 'string') { return } // nothing to sub to...

    this.appWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['appWindAngle'].path, this.config.paths['appWindAngle'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.appWindAngle = null;
          return;
        }

        let converted = this.UnitsService.convertUnit('deg', newValue);
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360

        if (converted < 0) {// stb
          this.appWindAngle = 360 + converted; // adding a negative number subtracts it...
        } else {
          this.appWindAngle = converted;
        }
      }
    );
  }

  unsubscribeAppWindAngle() {
    if (this.appWindAngleSub !== null) {
      this.appWindAngleSub.unsubscribe();
      this.appWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['appWindAngle'].path);
    }
  }

  onResized(event: ResizedEvent) {
    this.maxWidth = event.newHeight * 1.77;
  }

  openWidgetSettings() {
    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        this.config = result;
        console.log(result);
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);

        if (this.isApConnected) {
          this.stopAllSubscriptions();
          this.startAllSubscriptions();
        }
      }
    });
  }

  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }


  powerBtnClick(event: Event) {
    if (this.isApConnected) {

      this.stopAllSubscriptions();
      this.isApConnected = false;

      this.autoBtn.disabled = true;
      this.standbyBtn.disabled = true;
      this.plus1Btn.disabled = true;
      this.plus10Btn.disabled = true;
      this.minus1Btn.disabled = true;
      this.minus10Btn.disabled = true;
      this.messageBtn.disabled = true;
      this.stbTackBtn.disabled = true;
      this.prtTackBtn.disabled = true;

    } else {
      this.startAllSubscriptions();
      this.isApConnected = true;

      this.autoBtn.disabled = false;
      this.standbyBtn.disabled = false;
      this.plus1Btn.disabled = false;
      this.plus10Btn.disabled = false;
      this.minus1Btn.disabled = false;
      this.minus10Btn.disabled = false;
      this.messageBtn.disabled = false;
      this.stbTackBtn.disabled = false;
      this.prtTackBtn.disabled = false;
    }
  }

  buildAndSendCommand(cmd: string) {
    let cmdAction = commands[cmd];
    if (typeof cmdAction === 'undefined') {
      alert('Unknown Autopilot command: ' + cmd);
      return null;
    }
    if ((this.actionToBeConfirmed !== '')&&(this.actionToBeConfirmed !== cmd)) {
      this.clearConfirmCmd();
    }
    if ((cmd === 'route')&&(this.pilotStatus === 'route')&&(this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return null;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort')||(cmd === 'tackToStarboard')) {
        this.sendCommand(commands['auto']); // force mode 'auto' to take a tack
        this.sendCommand(cmdAction);
      }
      if ((cmd === 'route')&&(this.pilotStatus === 'route')) {
        this.sendCommand(commands['advanceWaypoint']);
      }
      return null;
    }
    this.sendCommand(cmdAction);
  }

  confirmAdvanceWaypoint(cmd) {
    let message = 'Repeat key TRACK<br>to confirm<br>Advance Waypoint';
    this.startConfirmCmd(cmd, message);
  }

  sendCommand(cmdAction) {
    console.log("Command action:" +  JSON.stringify(cmdAction));
    // reconnect = true;
    // wsConnect();
    // if ((ws === null) || (ws.readyState !== 1)) {
    //   errorIconDiv.style.visibility = 'visible';
    //   alert('Not connected yet, please retry your command...');
    //   return null;
    // }
    // console.log(cmdAction);
    // errorIconDiv.style.visibility = 'hidden';
    // sendIconDiv.style.visibility = 'visible';
    // var cmdActionJSON = JSON.stringify(cmdAction);
    // var cmdJson = '{"context":"vessels.self","requestId":"184743-434373-348483","put":' + cmdActionJSON + '}';
    // console.log(cmdJson);
    // ws.send(cmdJson);
    // setTimeout(() => {sendIconDiv.style.visibility = 'hidden';}, timeoutBlink);
  }

  startConfirmCmd(cmd, message) {
    this.countDownValue = countDownDefault;
    this.actionToBeConfirmed = cmd;
    this.updateCountDownCounter();
    this.apStencilConfirmCommand.nativeElement.innerHTML = '<p>' + message + '</p>';
    this.apStencilConfirmCommand.nativeElement.style.visibility = 'visible';

    clearTimeout(this.handleConfirmActionTimeout);

    this.handleConfirmActionTimeout = setTimeout(() => {
      this.apStencilConfirmCommand.nativeElement.style.visibility = 'hidden';
      this.apStencilConfirmCommand.nativeElement.innerHTML = '';
      this.actionToBeConfirmed = '';
    }, 5000);
  }

  clearConfirmCmd() : boolean {
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleCountDownCounterTimeout);
    this.countDownValue = -1;
    this.countDown.nativeElement.innerHTML = "";
    this.apStencilConfirmCommand.nativeElement.style.visibility = 'hidden';
    this.apStencilConfirmCommand.nativeElement.innerHTML = '';
    this.actionToBeConfirmed = '';
    return null;
  }

  updateCountDownCounter() {
    if (this.countDownValue > 0) {
      clearTimeout(this.handleCountDownCounterTimeout);
      this.countDown.nativeElement.innerHTML = this.countDownValue;
      this.countDownValue -= 1;
      this.handleCountDownCounterTimeout = setTimeout(() => {
        this.updateCountDownCounter();
      }, 1000);
    } else {
        clearTimeout(this.handleCountDownCounterTimeout);
        this.countDown.nativeElement.innerHTML = '';
    }
  }

}
