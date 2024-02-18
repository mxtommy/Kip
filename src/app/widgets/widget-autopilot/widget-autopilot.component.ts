import { ViewChild, Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatButton } from '@angular/material/button';

import { SignalkRequestsService, skRequest } from '../../signalk-requests.service';
import { WidgetManagerService} from '../../widget-manager.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

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
  templateUrl: './widget-autopilot.component.html'
})
export class WidgetAutopilotComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
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
  @ViewChild('muteBtn') muteBtn: MatButton;
  @ViewChild('messageBtn') messageBtn: MatButton;

  // AP Screen
  @ViewChild('appSvgAutopilot') apScreen : any;

  displayName: string;

  currentAPState: any = null;      // Current Pilot Mode - used for display, keyboard state and buildCommand function
  currentAPTargetAppWind: number = 0;
  currentHeading: number = 0;
  currentAppWindAngle: number = null;
  currentRudder: number = null;

  skApNotificationSub =  new Subscription;
  skRequestSub = new Subscription; // signalk-Request result observer

  // Widget var
  handleCountDownCounterTimeout = null;
  handleConfirmActionTimeout = null;
  handleMessageTimeout = null;
  handleReceiveTimeout = null;
  handleDisplayErrorTimeout = null;
  countDownValue: number = 0;
  actionToBeConfirmed: string = "";
  skPathToAck: string = "";
  preferedDisplayMode = defaultPpreferedDisplayMode;
  isWChecked: boolean = false;       // used for Wind toggle
  isTChecked: boolean = false;       // used for Track toggle
  isApConnected: boolean = false;
  notificationsArray = {};
  alarmsCount: number = 0;

  notificationTest = {};

  constructor(
    public signalkRequestsService: SignalkRequestsService,
    public widgetManagerService: WidgetManagerService) {
      super();

      this.defaultConfig = {
        displayName: 'N2k Autopilot',
        filterSelfPaths: true,
        paths: {
          "apState": {
            description: "Autopilot State",
            path: 'self.steering.autopilot.state',
            source: 'default',
            pathType: "string",
            isPathConfigurable: false,
            convertUnitTo: "",
            sampleTime: 500
          },
          "apTargetHeadingMag": {
            description: "Autopilot Target Heading Mag",
            path: 'self.steering.autopilot.target.headingMagnetic',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "apTargetWindAngleApp": {
            description: "Autopilot Target Wind Angle Apparent",
            path: 'self.steering.autopilot.target.windAngleApparent',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "apNotifications": {
            description: "Autopilot Notifications",
            path: 'self.notifications.autopilot.*', //TODO(David): need to add support for .* path subscription paths in sk service and widget config modal
            source: 'default',
            pathType: "string",
            convertUnitTo: "",
            isPathConfigurable: false,
            sampleTime: 500
          },
          "headingMag": {
            description: "Heading Magnetic",
            path: 'self.navigation.headingMagnetic',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "headingTrue": {
            description: "Heading True",
            path: 'self.navigation.headingTrue',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "windAngleApparent": {
            description: "Wind Angle Apparent",
            path: 'self.environment.wind.angleApparent',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "windAngleTrueWater": {
            description: "Wind Angle True Water",
            path: 'self.environment.wind.angleTrueWater',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
          "rudderAngle": {
            description: "Rudder Angle",
            path: 'self.steering.rudderAngle',
            source: 'default',
            pathType: "number",
            convertUnitTo: "deg",
            isPathConfigurable: true,
            sampleTime: 500
          },
        },
        usage: {
          "headingMag": ['wind', 'route', 'auto', 'standby'],
          "headingTrue": ['wind', 'route', 'auto', 'standby'],
          "windAngleApparent": ['wind'],
          "windAngleTrueWater": ['wind'],
        },
        typeVal: {
          "headingMag": 'Mag',
          "headingTrue": 'True',
          "windAngleApparent": 'AWA',
          "windAngleTrueWater": 'TWA',
        },
        barColor: 'accent',     // theme palette to select
        autoStart: false,
        enableTimeout: false,
        dataTimeout: 5
      };
    }

  ngOnInit() {
    this.validateConfig();
    if (this.widgetProperties.config.autoStart) {
      setTimeout(() => {this.startApHead();});
    }
    // this.demoMode(); // demo mode for troubleshooting
  }

  demoMode() {
    // this.setNotificationMessage('{"path":"notifications.autopilot.PilotWarningWindShift","value":{"state":"alarm","message":"Pilot Warning Wind Shift"}}');
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.unsubscribeSKRequest();
    this.unsubscribeAPNotification();
    console.log("Autopilot Subs Stopped");
  }

  startAllSubscriptions() {
    this.observeDataStream('apState', newValue => {
        this.currentAPState = newValue.value;
        this.SetKeyboardMode(this.currentAPState);
      }
    );

    this.observeDataStream('headingMag', newValue => {
        if (newValue.value === null) {
          this.currentHeading = 0;
        } else {
          this.currentHeading = newValue.value;
        }
      }
    );

    this.observeDataStream('windAngleApparent', newValue => {
        if (newValue.value === null) {
          this.currentAppWindAngle = null;
          return;
        }
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360

        if (newValue.value < 0) {// stb
          this.currentAppWindAngle = 360 + newValue.value; // adding a negative number subtracts it...
        } else {
          this.currentAppWindAngle = newValue.value;
        }
      }
    );

    this.observeDataStream('rudderAngle', newValue => {
        if (newValue.value === null) {
          this.currentRudder = 0;
        } else {
          this.currentRudder = newValue.value;
        }
      }
    );

    this.observeDataStream('apTargetWindAngleApp', newValue => {
        if (newValue.value === null) {
          this.currentAPTargetAppWind = 0;
        } else {
          this.currentAPTargetAppWind = newValue.value;
        }
      }
    );

    this.subscribeSKRequest();
    this.subscribeAPNotification();
    console.log("Autopilot Subs Started");
  }

  stopAllSubscriptions() {
    this.unsubscribeDataStream();
    this.unsubscribeSKRequest();
    this.unsubscribeAPNotification();
    console.log("Autopilot Subs Stopped");
  }

  subscribeAPNotification() {
    if (typeof(this.widgetProperties.config.paths['apNotifications'].path) != 'string') { return } // nothing to sub to...
    this.skApNotificationSub = this.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['apNotifications'].path, this.widgetProperties.config.paths['apNotifications'].source).subscribe(
      newValue => {
          if (!newValue.value == null) {
          this.setNotificationMessage(newValue.value);
          console.log(newValue.value);
          }
        }
    );
  }

  unsubscribeAPNotification() {
    if (this.skApNotificationSub !== null) {
      this.skApNotificationSub.unsubscribe();
      this.skApNotificationSub = null;
      this.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['apNotifications'].path);
    }
  }

  subscribeSKRequest() {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        this.commandReceived(requestResult);
      }
    });
  }

  unsubscribeSKRequest() {
    if (this.skRequestSub !== null) {
      this.skRequestSub.unsubscribe();
      this.skRequestSub = null;
    }
  }

  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

  powerBtnClick(event: Event) {
    if (!this.isApConnected) {
      this.startApHead();
    } else {
      this.stopApHead();
    }
  }

  startApHead() {
    this.startAllSubscriptions();
    this.widgetProperties.config.autoStart = true; // save power-on state to autostart or not
    this.widgetManagerService.updateWidgetConfig(this.widgetProperties.uuid, this.widgetProperties.config);

    this.isApConnected = true;
    this.muteBtn.disabled = true;
    this.messageBtn.disabled = false;
  }

  stopApHead() {
    this.muteBtn.disabled = true;
    this.messageBtn.disabled = true;
    this.windModeBtn.disabled = true;
    this.trackModeBtn.disabled = true;
    this.autoBtn.disabled = true;
    this.standbyBtn.disabled = true;
    this.plus1Btn.disabled = true;
    this.plus10Btn.disabled = true;
    this.minus1Btn.disabled = true;
    this.minus10Btn.disabled = true;
    this.prtTackBtn.disabled = true;
    this.stbTackBtn.disabled = true;

    this.apScreen.errorIconVisibility = 'hidden';

    this.isApConnected = false; // hide ap screen
    this.stopAllSubscriptions();
    this.widgetProperties.config.autoStart = false; // save power on state to autostart or not
    this.widgetManagerService.updateWidgetConfig(this.widgetProperties.uuid, this.widgetProperties.config);
  }

  SetKeyboardMode(apMode: string) {
    switch (apMode) {
      case "standby":
        this.trackModeBtn.disabled = true;
        this.autoBtn.disabled = false;
        this.standbyBtn.disabled = false;

        this.windModeBtn.disabled = false;
        this.plus1Btn.disabled = true;
        this.plus10Btn.disabled = true;
        this.minus1Btn.disabled = true;
        this.minus10Btn.disabled = true;
        this.prtTackBtn.disabled = true;
        this.stbTackBtn.disabled = true;
        break;

      case "auto":
        this.trackModeBtn.disabled = false;
        this.autoBtn.disabled = false;
        this.standbyBtn.disabled = false;

        this.windModeBtn.disabled = false;
        this.plus1Btn.disabled = false;
        this.plus10Btn.disabled = false;
        this.minus1Btn.disabled = false;
        this.minus10Btn.disabled = false;
        this.prtTackBtn.disabled = true;
        this.stbTackBtn.disabled = true;
        break;

      case "wind":
        this.trackModeBtn.disabled = true;
        this.autoBtn.disabled = false;
        this.standbyBtn.disabled = false;

        this.windModeBtn.disabled = false;
        this.plus1Btn.disabled = false;
        this.plus10Btn.disabled = false;
        this.minus1Btn.disabled = false;
        this.minus10Btn.disabled = false;
        this.prtTackBtn.disabled = false;
        this.stbTackBtn.disabled = false;
        break;

      case "route":
        this.trackModeBtn.disabled = false;
        this.autoBtn.disabled = false;
        this.standbyBtn.disabled = false;

        this.windModeBtn.disabled = true;
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
    if ((this.actionToBeConfirmed !== '') && (this.actionToBeConfirmed !== cmd)) {
      this.clearConfirmCmd();
    }
    if (((cmd === 'tackToPort')||(cmd === 'tackToStarboard'))&&(this.actionToBeConfirmed === '')) {
      this.confirmTack(cmd);
      return null;
    }
    if ((cmd === 'route')&&(this.currentAPState === 'route')&&(this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return null;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort')||(cmd === 'tackToStarboard')) {
        this.sendCommand(cmdAction);
      }
      if ((cmd === 'route')&&(this.currentAPState === 'route')) {
        this.sendCommand(commands['advanceWaypoint']);
      }
      return null;
    }
    this.sendCommand(cmdAction);
  }

  confirmAdvanceWaypoint(cmd: string) {
    let message: string = "Repeat key <b>[Next Wpt]</b><br>to confirm<br>Advance Waypoint";
    this.startConfirmCmd(cmd, message);
  }

  confirmTack(cmd: string) {
    let message = "Repeat same key<br>to confirm<br>tack to ";
    if (cmd === "tackToPort") {
      message += "port";
      this.actionToBeConfirmed = cmd;
    } else if (cmd === "tackToStarboard") {
        message += "starboard";
        this.actionToBeConfirmed = cmd;
      } else {
          this.actionToBeConfirmed = "";
          return null;
        }
    this.startConfirmCmd(cmd, message);
  }

  sendCommand(cmdAction) {
    let requestId = this.signalkRequestsService.putRequest(cmdAction["path"], cmdAction["value"], this.widgetProperties.uuid);
    this.apScreen.activityIconVisibility = "visible";
    setTimeout(() => {this.apScreen.activityIconVisibility = 'hidden';}, timeoutBlink);

    console.log("AP Action:\n" + JSON.stringify(cmdAction));
  }

  commandReceived(cmdResult: skRequest) {
    this.apScreen.activityIconVisibility = "visible";
    clearTimeout(this.handleReceiveTimeout);
    this.handleReceiveTimeout = setTimeout(() => {this.apScreen.activityIconVisibility = 'hidden';}, timeoutBlink);

    if (cmdResult.statusCode != 200){
      this.displayApError(cmdResult);
    } else {
      console.log("AP Received: \n" + JSON.stringify(cmdResult));
    }
  }

  startConfirmCmd(cmd: string, message: string) {
    this.countDownValue = countDownDefault;
    this.actionToBeConfirmed = cmd;

    this.apScreen.msgStencilInnerHTML = "<p>" + message + "</p>";
    this.apScreen.msgStencilVisibility = "visible";

    this.updateCountDownCounter(message);

    clearTimeout(this.handleConfirmActionTimeout);

    this.handleConfirmActionTimeout = setTimeout(() => {
      this.apScreen.msgStencilVisibility = "hidden";
      this.apScreen.msgStencilInnerHTML = "";
      this.actionToBeConfirmed = "";
    }, 5000);
  }

  clearConfirmCmd() : boolean {
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleCountDownCounterTimeout);
    this.countDownValue = -1;
    this.apScreen.msgStencilVisibility = "hidden";
    this.apScreen.msgStencilInnerHTML = "";
    this.actionToBeConfirmed = '';
    return null;
  }

  updateCountDownCounter(message: string) {
    if (this.countDownValue > 0) {
      clearTimeout(this.handleCountDownCounterTimeout);
      this.apScreen.msgStencilInnerHTML = "<p>" + message + "</p>" + "<h1 class='counterText'>" + this.countDownValue.toString() + "</h1>";
      this.countDownValue -= 1;
      this.handleCountDownCounterTimeout = setTimeout(() => {
        this.updateCountDownCounter(message);
      }, 1000);
    } else {
        clearTimeout(this.handleCountDownCounterTimeout);
    }
  }

  displayApError(cmdResult: skRequest) {
    let errMsg = cmdResult.statusCode + " - " +cmdResult.statusCodeDescription;
    if (cmdResult.message){
      errMsg = errMsg + " Server Message: " + cmdResult.message;
    }
    this.apScreen.errorStencilInnerText = errMsg;
    this.apScreen.errorStencilVisibility = "visible";

    clearTimeout(this.handleDisplayErrorTimeout);

    this.handleDisplayErrorTimeout = setTimeout(() => {
      this.apScreen.errorStencilVisibility = "hidden";
      this.apScreen.errorStencilInnerText = "";
    }, 6000);
    this.apScreen.errorIconVisibility = 'visible';
  }

  getNextNotification(skPath: string): string {
    let notificationsKeys = Object.keys(this.notificationsArray);
    let newSkPathToAck: string = "";
    let index: number = 0;
    if (notificationsKeys.length > 0) {
      if (typeof skPath !== "undefined") {
        index = notificationsKeys.indexOf(skPath) + 1;
      } else {
          index = 0;
        }
      if (notificationsKeys.length <= index) {
        index = 0;
      }
      newSkPathToAck = notificationsKeys[index];
    }
    return newSkPathToAck;
  }

  setNotificationMessage(value) {
    this.apScreen.activityIconVisibility = "visible";
    clearTimeout(this.handleReceiveTimeout);
    this.handleReceiveTimeout = setTimeout(() => {this.apScreen.activityIconVisibility = 'hidden';}, timeoutBlink);

    if (typeof value.path !== 'undefined') {
      value.path = value.path.replace('notifications.', '');
      if (typeof value.value !== 'undefined') {
        if (value.value.state === 'normal') {
          if (this.apScreen.messageInnerText === this.notificationsArray[value.path]) {
            this.apScreen.messageInnerText = '';
          }
          delete this.notificationsArray[value.path]
        } else {
            this.notificationsArray[value.path] = value.value.message.replace("Pilot", "");
            this.apScreen.messageInnerText = this.notificationsArray[value.path];
          }
      }
    }
    this.alarmsCount = Object.keys(this.notificationsArray).length;
    if (this.alarmsCount > 0) {
      this.muteBtn.disabled = false;
      if (this.apScreen.messageInnerText == "") {
        this.apScreen.messageInnerText = Object.keys(this.notificationsArray)[0];
      }
    } else {
        this.muteBtn.disabled = true;
        this.alarmsCount = 0;
        this.apScreen.messageInnerText = "";
      }
  }

  notificationToValue(skPathToAck: string): string {
    let message: string = this.notificationsArray[skPathToAck];
    if (typeof message == "undefined") {
      message = "No alarm present...";
    }
    return message;
  }

  notificationScroll() {
    if ((Object.keys(this.notificationsArray).length > 0) && (this.skPathToAck == "")) {
      this.skPathToAck = Object.keys(this.notificationsArray)[0];
    }

    this.skPathToAck = this.getNextNotification(this.skPathToAck);
    // Not sure about this DIV ??? May be message area???
    // silenceScreenTextDiv.innerHTML = notificationToValue(skPathToAck);
    this.apScreen.messageInnerText = this.notificationToValue(this.skPathToAck);
    this.apScreen.messageVisibility = 'visible';
    clearTimeout(this.handleMessageTimeout);
    this.handleMessageTimeout = setTimeout(() => {
      this.apScreen.messageInnerText = "";
      this.apScreen.messageVisibility = 'hidden';
    }, 2000);
  }

  sendSilence() {
    if (this.apScreen.messageVisibility != 'visible') {
      this.apScreen.messageVisibility = 'visible';

      if ((Object.keys(this.notificationsArray).length > 0) && (this.skPathToAck == "")) {
        this.skPathToAck = Object.keys(this.notificationsArray)[0];
      }
    } else {
        if (this.skPathToAck !== "") {
          this.sendCommand({"path":"notifications." + this.skPathToAck + ".state","value":"normal"});
          // this.sendCommand({"path":"notifications." + skPathToAck + ".method","value":[]});
        }
        this.apScreen.messageVisibility = 'hidden';
      }
      this.apScreen.messageInnerText = this.notificationToValue(this.skPathToAck);
  }
}
