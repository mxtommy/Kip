import { MatIconModule } from '@angular/material/icon';
import { SvgRudderComponent } from './../svg-rudder/svg-rudder.component';
import { Component, OnInit, OnDestroy, viewChild, inject, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatButton } from '@angular/material/button';

import { SignalkRequestsService, skRequest } from '../../core/services/signalk-requests.service';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgAutopilotComponent } from '../svg-autopilot/svg-autopilot.component';
import { NgClass, TitleCasePipe } from '@angular/common';
import { WidgetDatetimeComponent } from '../widget-datetime/widget-datetime.component';
import { WidgetPositionComponent } from '../widget-position/widget-position.component';


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
    selector: 'widget-autopilot',
    templateUrl: './widget-autopilot.component.html',
    styleUrls: ['./widget-autopilot.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, SvgAutopilotComponent, MatButton, SvgRudderComponent, TitleCasePipe, MatIconModule, NgClass, WidgetPositionComponent],
})
export class WidgetAutopilotComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  signalkRequestsService = inject(SignalkRequestsService);

  // AP keypad
  protected readonly plus1Btn = viewChild.required<MatButton>('plus1Btn');
  protected readonly minus1Btn = viewChild.required<MatButton>('minus1Btn');
  protected readonly plus10Btn = viewChild.required<MatButton>('plus10Btn');
  protected readonly minus10Btn = viewChild.required<MatButton>('minus10Btn');
  protected readonly stbTackBtn = viewChild.required<MatButton>('stbTackBtn');
  protected readonly prtTackBtn = viewChild.required<MatButton>('prtTackBtn');
  protected readonly modesBtn = viewChild.required<MatButton>('modesBtn');
  protected readonly engageBtn = viewChild.required<MatButton>('engageBtn');
  protected readonly advWptBtn = viewChild.required<MatButton>('advWptBtn');
  protected readonly overrideBtn = viewChild.required<MatButton>('overrideBtn');

  protected displayName: string;

  protected apState = signal<string>('standby'); // Current Pilot Mode - used for display, keyboard state and buildCommand function
  protected currentAPTargetAppWind: number = 0;
  protected currentAPTargetHeadingMag: number = 0;
  protected currentHeading: number = 0;
  protected currentAppWindAngle: number = null;
  protected currentRudder: number = null;

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
  isWChecked: boolean = false;       // used for Wind toggle
  isTChecked: boolean = false;       // used for Track toggle
  isApConnected: boolean = false;
  notificationsArray = {};
  alarmsCount: number = 0;

  notificationTest = {};
  protected nextWptProperties = {
    type: "widget-position",
    uuid: "db473695-42b1-4835-9d3d-ac2f27bf9665",
    config: {
      displayName: "Next WPT",
      filterSelfPaths: true,
      paths: {
        "longPath": {
          description: "Longitude",
          path: "self.navigation.courseRhumbline.nextPoint.position.longitude",
          source: "default",
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "longitudeMin",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        "latPath": {
          description: "Latitude",
          path: "self.navigation.courseGreatCircle.nextPoint.position.latitude",
          source: "default",
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "latitudeMin",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        }
      },
      color: "contrast",
      enableTimeout: false,
      dataTimeout: 5
    }
  }
  protected readonly apModeRows = computed(() =>{
    let mode = this.apState();
    switch (mode) {
      case "standby":
        this.modesBtn().disabled = false;
        this.engageBtn().disabled = false;
        this.plus1Btn().disabled = true;
        this.plus10Btn().disabled = true;
        this.minus1Btn().disabled = true;
        this.minus10Btn().disabled = true;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
        this.advWptBtn().disabled = true;
        this.overrideBtn().disabled = true;
        break;
      case "auto":
        this.modesBtn().disabled = false;
        this.engageBtn().disabled = false;
        this.plus1Btn().disabled = false;
        this.plus10Btn().disabled = false;
        this.minus1Btn().disabled = false;
        this.minus10Btn().disabled = false;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
        this.advWptBtn().disabled = true;
        this.overrideBtn().disabled = true;
        break;
      case "wind":
        this.modesBtn().disabled = false;
        this.engageBtn().disabled = false;
        this.plus1Btn().disabled = false;
        this.plus10Btn().disabled = false;
        this.minus1Btn().disabled = false;
        this.minus10Btn().disabled = false;
        this.prtTackBtn().disabled = false;
        this.stbTackBtn().disabled = false;
        this.advWptBtn().disabled = true;
        this.overrideBtn().disabled = true;
        break;
      case "route":
        this.modesBtn().disabled = false;
        this.engageBtn().disabled = false;
        this.plus1Btn().disabled = true;
        this.plus10Btn().disabled = true;
        this.minus1Btn().disabled = true;
        this.minus10Btn().disabled = true;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
        this.advWptBtn().disabled = false;
        this.overrideBtn().disabled = false;
        break;
      default:
        break;
    }
    return mode;
  });

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'N2k Autopilot',
      filterSelfPaths: true,
      paths: {
        // TODO: maybe need to remove - not needed anymore
        "apState": {
          description: "Autopilot State",
          path: 'self.steering.autopilot.state',
          source: 'default',
          pathType: "string",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
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
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "apTargetWindAngleApp": {
          description: "Autopilot Target Wind Angle Apparent",
          path: 'self.steering.autopilot.target.windAngleApparent',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "headingMag": {
          description: "Heading Magnetic",
          path: 'self.navigation.headingMagnetic',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "headingTrue": {
          description: "Heading True",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "windAngleApparent": {
          description: "Wind Angle Apparent",
          path: 'self.environment.wind.angleApparent',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "windAngleTrueWater": {
          description: "Wind Angle True Water",
          path: 'self.environment.wind.angleTrueWater',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "rudderAngle": {
          description: "Rudder Angle",
          path: 'self.steering.rudderAngle',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
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
      invertRudder: true,
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    if (this.widgetProperties.config.autoStart) {
      setTimeout(() => {this.startApHead();});
    }
    this.startWidget();
  }

  protected startWidget(): void {
    this.startAllSubscriptions();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.unsubscribeSKRequest();
    console.log("Autopilot Subs Stopped");
  }

  startAllSubscriptions() {
    this.observeDataStream('apState', newValue => {
        this.apState.set(newValue.data.value);
        this.SetKeyboardMode(this.apState());
      }
    );

    this.observeDataStream('headingMag', newValue => {
        if (newValue.data.value === null) {
          this.currentHeading = 0;
        } else {
          this.currentHeading = newValue.data.value;
        }
      }
    );

    this.observeDataStream('windAngleApparent', newValue => {
        if (newValue.data.value === null) {
          this.currentAppWindAngle = null;
          return;
        }

        if (newValue.data.value < 0) {// stb
          this.currentAppWindAngle = 360 + newValue.data.value; // adding a negative number subtracts it...
        } else {
          this.currentAppWindAngle = newValue.data.value;
        }
      }
    );

    this.observeDataStream('rudderAngle', newValue => {
        if (newValue.data.value === null) {
          this.currentRudder = 0;
        } else {
          this.currentRudder = this.widgetProperties.config.invertRudder ? -newValue.data.value : newValue.data.value;
        }
      }
    );

    this.observeDataStream('apTargetHeadingMag', newValue => {
        if (newValue.data.value === null) {
          this.currentAPTargetHeadingMag = 0;
        } else {
          this.currentAPTargetHeadingMag = newValue.data.value;
        }
      }
    );

    this.observeDataStream('apTargetWindAngleApp', newValue => {
        if (newValue.data.value === null) {
          this.currentAPTargetAppWind = 0;
        } else {
          this.currentAPTargetAppWind = newValue.data.value;
        }
      }
    );

    this.subscribeSKRequest();
    console.log("Autopilot Subs Started");
  }

  stopAllSubscriptions() {
    this.unsubscribeDataStream();
    this.unsubscribeSKRequest();
    console.log("Autopilot Subs Stopped");
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
    this.isApConnected = true;
  }

  stopApHead() {
    this.modesBtn().disabled = true;
    this.plus1Btn().disabled = true;
    this.plus10Btn().disabled = true;
    this.minus1Btn().disabled = true;
    this.minus10Btn().disabled = true;
    this.prtTackBtn().disabled = true;
    this.stbTackBtn().disabled = true;

    this.isApConnected = false; // hide ap screen
    this.stopAllSubscriptions();
    this.widgetProperties.config.autoStart = false; // save power on state to autostart or not
  }

  SetKeyboardMode(apMode: string) {
    switch (apMode) {
      case "standby":
        this.modesBtn().disabled = false;
        this.plus1Btn().disabled = true;
        this.plus10Btn().disabled = true;
        this.minus1Btn().disabled = true;
        this.minus10Btn().disabled = true;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
        break;

      case "auto":
        this.modesBtn().disabled = false;
        this.plus1Btn().disabled = false;
        this.plus10Btn().disabled = false;
        this.minus1Btn().disabled = false;
        this.minus10Btn().disabled = false;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
        break;

      case "wind":
        this.modesBtn().disabled = false;
        this.plus1Btn().disabled = false;
        this.plus10Btn().disabled = false;
        this.minus1Btn().disabled = false;
        this.minus10Btn().disabled = false;
        this.prtTackBtn().disabled = false;
        this.stbTackBtn().disabled = false;
        break;

      case "route":
        this.modesBtn().disabled = false;
        this.plus1Btn().disabled = true;
        this.plus10Btn().disabled = true;
        this.minus1Btn().disabled = true;
        this.minus10Btn().disabled = true;
        this.prtTackBtn().disabled = true;
        this.stbTackBtn().disabled = true;
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
    if ((cmd === 'route')&&(this.apState() === 'route')&&(this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return null;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort')||(cmd === 'tackToStarboard')) {
        this.sendCommand(cmdAction);
      }
      if ((cmd === 'route')&&(this.apState() === 'route')) {
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
    console.log("AP Action:\n" + JSON.stringify(cmdAction));
  }

  commandReceived(cmdResult: skRequest) {
    if (cmdResult.statusCode != 200){
      this.displayApError(cmdResult);
    } else {
      console.log("AP Received: \n" + JSON.stringify(cmdResult));
    }
  }

  startConfirmCmd(cmd: string, message: string) {
 }

  clearConfirmCmd() : void {
  }

  updateCountDownCounter(message: string) {
  }

  displayApError(cmdResult: skRequest) {
  }

  getNextNotification(skPath: string): void {

  }

  setNotificationMessage(value) {

  }

  notificationToValue(skPathToAck: string): string {
    let message: string = this.notificationsArray[skPathToAck];
    if (typeof message == "undefined") {
      message = "No alarm present...";
    }
    return message;
  }

  notificationScroll() {

  }

  sendSilence() {
  }
}
