import { ViewChild, Input, ElementRef, Component, HostBinding, OnInit, AfterContentInit, AfterContentChecked, OnDestroy, ViewChildren, ContentChild, ContentChildren } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { MatDialog, MatButton } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { SignalkRequestsService, skRequest } from '../signalk-requests.service';
import { SignalKDeltaService } from '../signalk-delta.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { NgSwitch, NgSwitchCase } from '@angular/common';



const defaultConfig: IWidgetConfig = {
  widgetLabel: 'N2k Autopilot',
  paths: {
    "apState": {
      description: "Autopilot State",
      path: 'self.steering.autopilot.state',
      source: 'default',
      pathType: "string",
    },
    "apTargetHeadingMag": {
      description: "Autopilot Target Heading Mag",
      path: 'self.steering.autopilot.target.headingMagnetic',
      source: 'default',
      pathType: "number",
    },
    "apTargetWindAngleApp": {
      description: "Autopilot Target Wind Angle Apparent",
      path: 'self.steering.autopilot.target.windAngleApparent',
      source: 'default',
      pathType: "number",
    },
    "apNotifications": {
      description: "Autopilot Notifications",
      path: 'self.notifications.autopilot.*',
      source: 'default',
      pathType: "number",
    },
    "headingMag": {
      description: "Heading Magnetic",
      path: 'self.navigation.headingMagnetic',
      source: 'default',
      pathType: "number",
    },
    "headingTrue": {
      description: "Heading True",
      path: 'self.navigation.headingTrue',
      source: 'default',
      pathType: "number",
    },
    "windAngleApparent": {
      description: "Wind Angle Apparent",
      path: 'self.environment.wind.angleApparent',
      source: 'default',
      pathType: "number",
    },
    "windAngleTrueWater": {
      description: "Wind Angle True Water",
      path: 'self.environment.wind.angleTrueWater',
      source: 'default',
      pathType: "number",
    },
    "rudderAngle": {
      description: "Rudder Angle",
      path: 'self.steering.rudderAngle',
      source: 'default',
      pathType: "number",
    },
  },
  units: {
    "apTargetHeadingMag": "angle",
    "apTargetWindAngleApp": "angle",
    "apNotifications": "unitless",
    "headingMag": "angle",
    "headingTrue": "angle",
    "windAngleApparent": "angle",
    "windAngleTrueWater": "angle",
    "rudderAngle": "angle",
  },
  usage: {
    "headingMag": ['wind', 'route', 'auto', 'standby'],
    "headingTrue": ['wind', 'route', 'auto', 'standby'],
    "windAngleApparent": ['wind'],
    "windAngleTrueWater": ['wind'],
  },
  handleTimeout: {
    "headingMag": null,
    "headingTrue": null,
    "windAngleApparent": null,
    "windAngleTrueWater": null,
  },
  typeVal: {
    "headingMag": 'Mag',
    "headingTrue": 'True',
    "windAngleApparent": 'AWA',
    "windAngleTrueWater": 'TWA',
  },

  selfPaths: true,
  barColor: 'accent',     // theme palette to select
  autoStart: false,
};

const defaultPpreferedDisplayMode = {
  wind: 'windAngleApparent',
  route: 'headingMag',
  auto: 'headingMag',
  standby: 'headingMag'
}

const commands = {
  "auto":    {"path":"self.steering.autopilot.state","value":"auto"},
  "wind":    {"path":"self.steering.autopilot.state","value":"wind"},
  "route":   {"path":"self.steering.autopilot.state","value":"route"},
  "standby": {"path":"self.steering.autopilot.state","value":"standby"},
  "+1":      {"path":"self.steering.autopilot.actions.adjustHeading","value":1},
  "+10":     {"path":"self.steering.autopilot.actions.adjustHeading","value":10},
  "-1":      {"path":"self.steering.autopilot.actions.adjustHeading","value":-1},
  "-10":     {"path":"self.steering.autopilot.actions.adjustHeading","value":-10},
  "tackToPort":   {"path":"self.steering.autopilot.actions.tack","value":"port"},
  "tackToStarboard":   {"path":"self.steering.autopilot.actions.tack","value":"starboard"},
  "advanceWaypoint":   {"path":"self.steering.autopilot.actions.advanceWaypoint","value":"1"}
};

const noData = '-- -- -- --';
const noPilot = 'No pilot';
const noHeading = '---&deg;';
const countDownDefault: number = 5;
const timeoutBlink = 250;

@Component({
  selector: 'app-widget-autopilot',
  templateUrl: './widget-autopilot.component.html',
  styleUrls: ['./widget-autopilot.component.scss'],
})
export class WidgetAutopilotComponent implements OnInit, OnDestroy {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

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

  // AP Screen
  @ViewChild('appSvgAutopilot') apScreen : any;

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

  // Subscription stuff
  currentAPState: any = null;
  apStateSub: Subscription = null;

  currentAPTargetAppWind: number = 0;
  apTargetAppWindSub: Subscription = null;

  currentHeading: number = 0;
  headingSub: Subscription = null;

  currentAppWindAngle: number = null;
  appWindAngleSub: Subscription = null;

  currentRudder: number = null;
  rudderSub: Subscription = null;

  isApConnected: boolean = false;

  // Widget var
  handleCountDownCounterTimeout = null;
  handleConfirmActionTimeout = null;
  countDownValue: number = 0;
  handleReceiveTimeout = null;
  actionToBeConfirmed: string = "";
  skPathToAck = '';
  preferedDisplayMode = defaultPpreferedDisplayMode;
  pilotStatus: string = "";         // pilot current mode

  // cmdConfirmed: boolean = false;
  skRequestSub = new Subscription; // Request result observer

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private SignalkRequestsService: SignalkRequestsService,
    private SignalKDeltaService: SignalKDeltaService,
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
    if (this.config.autoStart) {
      setTimeout(() => {this.startAP();});
    }
  }

  ngOnDestroy() {
    this.stopAllSubscriptions();
  }

  startAllSubscriptions() {
    this.subscribeHeading();
    this.subscribeAppWindAngle();
    this.subscribeRudder();
    this.subscribeAPState();
    this.subscribeAPTargetAppWind();
    this.subscribeSKRequest();
    console.log("Autopilot Sub Started");
  }

  stopAllSubscriptions() {
    this.unsubscribeHeading();
    this.unsubscribeAppWindAngle();
    this.unsubscribeRudder();
    this.unsubscribeAPState();
    this.unsubscribeAPTargetAppWind();
    this.unsubscribeSKRequest();
    console.log("Autopilot Subs Stopped");
  }

  subscribeSKRequest() {
    this.skRequestSub = this.SignalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetUUID) {
        this.commandReceived(requestResult);
      }
    });
  }

  unsubscribeSKRequest() {
    this.skRequestSub.unsubscribe();
  }

  subscribeAPTargetAppWind() {
    this.unsubscribeAPTargetAppWind();
    if (typeof(this.config.paths['apTargetWindAngleApp'].path) != 'string') { return } // nothing to sub to...
    this.apTargetAppWindSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['apTargetWindAngleApp'].path, this.config.paths['apTargetWindAngleApp'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.currentAPTargetAppWind = 0;
        } else {
          this.currentAPTargetAppWind = this.UnitsService.convertUnit('deg', newValue);
        }
      }
    );
  }

  unsubscribeAPTargetAppWind() {
    if (this.apTargetAppWindSub !== null) {
      this.apTargetAppWindSub.unsubscribe();
      this.apTargetAppWindSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['apTargetWindAngleApp'].path);
    }
  }

  subscribeAPState() {
    this.unsubscribeAPState();
    if (typeof(this.config.paths['apState'].path) != 'string') { return } // nothing to sub to...
    this.apStateSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['apState'].path, this.config.paths['apState'].source).subscribe(
      newValue => {
        this.currentAPState = newValue;
        this.SetKeyboardMode(this.currentAPState);
      }
    );
  }

  unsubscribeAPState() {
    if (this.apStateSub !== null) {
      this.apStateSub.unsubscribe();
      this.apStateSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['apState'].path);
    }
  }

  subscribeHeading() {
    this.unsubscribeHeading();
    if (typeof(this.config.paths['headingMag'].path) != 'string') { return } // nothing to sub to...
    this.headingSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['headingMag'].path, this.config.paths['headingMag'].source).subscribe(
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
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['headingMag'].path);
    }
  }

  subscribeAppWindAngle() {
    this.unsubscribeAppWindAngle();
    if (typeof(this.config.paths['windAngleApparent'].path) != 'string') { return } // nothing to sub to...

    this.appWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['windAngleApparent'].path, this.config.paths['windAngleApparent'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.currentAppWindAngle = null;
          return;
        }

        let converted = this.UnitsService.convertUnit('deg', newValue);
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360

        if (converted < 0) {// stb
          this.currentAppWindAngle = 360 + converted; // adding a negative number subtracts it...
        } else {
          this.currentAppWindAngle = converted;
        }
      }
    );
  }

  unsubscribeAppWindAngle() {
    if (this.appWindAngleSub !== null) {
      this.appWindAngleSub.unsubscribe();
      this.appWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['windAngleApparent'].path);
    }
  }

  subscribeRudder() {
    this.unsubscribeRudder();
    if (typeof(this.config.paths['rudderAngle'].path) != 'string') { return } // nothing to sub to...
    this.rudderSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['rudderAngle'].path, this.config.paths['rudderAngle'].source).subscribe(
      newValue => {
        if (newValue === null) {
          this.currentRudder = 0;
        } else {

          this.currentRudder = this.UnitsService.convertUnit('deg', newValue);
        }

      }
    );
  }

  unsubscribeRudder() {
    if (this.rudderSub !== null) {
      this.rudderSub.unsubscribe();
      this.rudderSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['rudderAngle'].path);
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
    this.startAP();
  }

  startAP() {
    if (this.isApConnected) {       // Are the subs active and we pressed power, or are we back from another page
      this.stopAllSubscriptions();
      this.config.autoStart = false; // save power on state to autostart or not
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
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
      this.config.autoStart = true; // save power-on state to autostart or not
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
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
      this.apScreen.errorIconVisibility = 'hidden';
    }
  }

  SetKeyboardMode(apMode: string) {
    switch (apMode) {
      case "standby":
        break;

      case "auto":
        break;

      case "wind":
        break;

      case "route":
        this.autoBtn.disabled = false;
        this.standbyBtn.disabled = false;
        this.plus1Btn.disabled = true;
        this.plus10Btn.disabled = true;
        this.minus1Btn.disabled = true;
        this.minus10Btn.disabled = true;
        this.prtTackBtn.disabled = true;
        this.stbTackBtn.disabled = true;

        break;

      default:
        break;
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
    let requestId = this.SignalkRequestsService.putRequest(cmdAction["path"], cmdAction["value"], this.widgetUUID);
    this.apScreen.activityIconVisibility = "visible";
    setTimeout(() => {this.apScreen.activityIconVisibility = 'hidden';}, timeoutBlink);

    console.log("AP Action: " + cmdAction["value"]);

  }

  commandReceived(cmdResult: skRequest) {
    this.apScreen.activityIconVisibility = "visible";
    clearTimeout(this.handleReceiveTimeout);
    this.handleReceiveTimeout = setTimeout(() => {this.apScreen.activityIconVisibility = 'hidden';}, timeoutBlink);

    if (typeof cmdResult.requestId !== 'undefined') {
      if (cmdResult.state === 'COMPLETED') {
        if (cmdResult.statusCode === 403) {
          this.apScreen.errorIconVisibility = "visible"
          alert('[Status Code ' + cmdResult.statusCode + ']: ' + 'You must be authenticated to send command');
        } else if (cmdResult.statusCode !== 200) {
          this.apScreen.errorIconVisibility = 'visible';
          alert('[' + cmdResult.statusCode + ']' + cmdResult.message);
        }
      }
    }

    // var jsonData = JSON.parse(event.data)
    // if (typeof jsonData.requestId !== 'undefined') {
    //   if (jsonData.state === 'COMPLETED') {
    //     if (jsonData.statusCode === 403) {
    //       errorIconDiv.style.visibility = 'visible';
    //       alert('[' + jsonData.statusCode + ']' + 'You must be authenticated to send command');
    //     } else if (jsonData.statusCode !== 200) {
    //       errorIconDiv.style.visibility = 'visible';
    //       alert('[' + jsonData.statusCode + ']' + jsonData.message);
    //     }
    //   }

    console.log("AP Received: \n" + JSON.stringify(cmdResult));
  }

  startConfirmCmd(cmd, message) {
    this.countDownValue = countDownDefault;
    this.actionToBeConfirmed = cmd;
    this.updateCountDownCounter();
    // this.apStencilConfirmCommand.nativeElement.innerHTML = '<p>' + message + '</p>';
    // this.apStencilConfirmCommand.nativeElement.style.visibility = 'visible';

    clearTimeout(this.handleConfirmActionTimeout);

    this.handleConfirmActionTimeout = setTimeout(() => {
      // this.apStencilConfirmCommand.nativeElement.style.visibility = 'hidden';
      // this.apStencilConfirmCommand.nativeElement.innerHTML = '';
      this.actionToBeConfirmed = '';
    }, 5000);
  }

  clearConfirmCmd() : boolean {
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleCountDownCounterTimeout);
    this.countDownValue = -1;
    // this.countDown.nativeElement.innerHTML = "";
    // this.apStencilConfirmCommand.nativeElement.style.visibility = 'hidden';
    // this.apStencilConfirmCommand.nativeElement.innerHTML = '';
    this.actionToBeConfirmed = '';
    return null;
  }

  updateCountDownCounter() {
    if (this.countDownValue > 0) {
      clearTimeout(this.handleCountDownCounterTimeout);
      // this.countDown.nativeElement.innerHTML = this.countDownValue;
      this.countDownValue -= 1;
      this.handleCountDownCounterTimeout = setTimeout(() => {
        this.updateCountDownCounter();
      }, 1000);
    } else {
        clearTimeout(this.handleCountDownCounterTimeout);
        // this.countDown.nativeElement.innerHTML = '';
    }
  }

  notificationScroll(){}

  sendSilence() {}
}
