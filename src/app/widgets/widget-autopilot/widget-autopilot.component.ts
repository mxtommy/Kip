import { Component, OnInit, OnDestroy, viewChild, inject, signal, effect, untracked, DestroyRef } from '@angular/core';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TitleCasePipe } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidget, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgAutopilotComponent } from '../svg-autopilot/svg-autopilot.component';
import { WidgetPositionComponent } from '../widget-position/widget-position.component';
import { WidgetNumericComponent } from '../widget-numeric/widget-numeric.component';
import { WidgetDatetimeComponent } from "../widget-datetime/widget-datetime.component";
import { DashboardService } from '../../core/services/dashboard.service';
import { SignalkRequestsService, skRequest } from '../../core/services/signalk-requests.service';
import { isEqual } from 'lodash-es';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SignalkPluginsService } from '../../core/services/signalk-plugins.service';
import { AppService } from '../../core/services/app-service';

interface CommandDefinition {
  path: string;
  value: string | number;
}

type CommandsMap = Record<string, CommandDefinition>;

const commands: CommandsMap = {
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
const countDownDefault = 5;

interface MenuItem {
  label: string;
  action: string;
  current?: boolean;
  isCancel?: boolean;
  disabled?: boolean;
}

@Component({
    selector: 'widget-autopilot',
    templateUrl: './widget-autopilot.component.html',
    styleUrls: ['./widget-autopilot.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, SvgAutopilotComponent, MatButtonModule, TitleCasePipe, MatIconModule, MatBadgeModule, WidgetPositionComponent, WidgetNumericComponent, WidgetDatetimeComponent],
})
export class WidgetAutopilotComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private readonly signalkRequestsService = inject(SignalkRequestsService);
  protected readonly dashboard = inject(DashboardService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _plugins = inject(SignalkPluginsService);
  protected readonly _app = inject(AppService);

  // Keypad buttons & layout
  protected apGrid = signal('none'); // Autopilot button grid visibility
  protected readonly plus1Btn = viewChild.required<MatButton>('plus1Btn');
  protected readonly minus1Btn = viewChild.required<MatButton>('minus1Btn');
  protected readonly plus10Btn = viewChild.required<MatButton>('plus10Btn');
  protected readonly minus10Btn = viewChild.required<MatButton>('minus10Btn');
  protected readonly stbTackBtn = viewChild.required<MatButton>('stbTackBtn');
  protected readonly prtTackBtn = viewChild.required<MatButton>('prtTackBtn');
  protected readonly modesBtn = viewChild.required<MatButton>('modesBtn');
  protected readonly engageBtn = viewChild.required<MatButton>('disengageBtn');
  protected readonly advWptBtn = viewChild.required<MatButton>('advWptBtn');
  // protected readonly dodgeBtn = viewChild.required<MatButton>('dodgeBtn');

  protected apState = signal<string | null>(null); // Current Pilot Mode - used for display, keyboard state and buildCommand function
  protected autopilotTargetHeading = 0;
  protected autopilotTargetWindHeading = 0;
  protected courseTargetHeading = 0;
  protected heading = 0;
  protected crossTrackError = 0;
  protected windAngleApparent = 0;
  protected rudder = 0;

  // Widget messaging countdown
  protected countdownOverlayVisibility = signal<string>('hidden');
  protected countdownOverlayText = signal<string>('');
  protected msgOverlayVisibility = signal<string>('hidden');
  protected msgOverlayText = signal<string>('');
  protected errorOverlayVisibility = signal<string>('hidden');
  protected errorOverlayText = signal<string>('');
  private handleCountDownCounterTimeout = null;
  private handleConfirmActionTimeout = null;
  private handleDisplayErrorTimeout = null;
  protected countDownValue = -1;
  private actionToBeConfirmed = "";

  // Mode Menu
  protected menuOpen = signal<boolean>(false);
  protected menuItems: MenuItem[] = [];
  protected readonly itemHeight = 60;
  protected readonly padding = 20;

  // Sub widget properties
  private embedWidgetColor = 'contrast';
  protected nextWptProperties = signal<IWidget>({
    type: "widget-position",
    uuid: "db473695-42b1-4435-9d3d-ac2f27bf9665",
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
      color: this.embedWidgetColor,
      enableTimeout: false,
      dataTimeout: 5
    }
  }, {equal: isEqual});
  protected ttwProperties = signal<IWidget>({
    type: "widget-numeric",
    uuid: "ee022f2f-ee23-41a7-b0b1-0928dc28864d",
    config: {
      displayName: "TTWpt",
      filterSelfPaths: true,
      paths: {
        numericPath: {
          description: "Time To Waypoint",
          path: "self.navigation.course.calcValues.timeToGo",
          source: "default",
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "D HH:MM:SS",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        }
      },
      showMax: false,
      showMin: false,
      numDecimal: 1,
      numInt: 1,
      color: this.embedWidgetColor,
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    }
  }, {equal: isEqual});
  protected etaProperties = signal<IWidget>({
    type: "widget-datetime",
    uuid: "544ca35d-18bf-4a90-9aa8-b12312e3fc60",
    config: {
      displayName: "ETA",
      filterSelfPaths: true,
      paths: {
        gaugePath: {
          description: "Estimated Time Of Arrival Date",
          path: "self.navigation.course.calcValues.estimatedTimeOfArrival",
          source: "default",
          pathType: "Date",
          isPathConfigurable: true,
          sampleTime: 500
        }
      },
      dateFormat: "EEE HH:mm",
      dateTimezone: "System Timezone -",
      color: this.embedWidgetColor,
      enableTimeout: false,
      dataTimeout: 5
    }
  }, {equal: isEqual});
  protected dtwProperties = signal<IWidget>({
    type : "widget-numeric",
    uuid : "ee02ef2f-ee23-41a7-b0b1-0928dc28864d",
    config : {
      displayName  : "DTWpt",
      filterSelfPaths  : true,
      paths  : {
        numericPath  : {
          description  : "Distance To Waypoint",
          path  : "self.navigation.course.calcValues.distance",
          source  : "default",
          pathType  : "number",
          isPathConfigurable  : true,
          convertUnitTo  : "nm",
          showPathSkUnitsFilter  : true,
          pathSkUnitsFilter  : null,
          sampleTime  : 500
        }
      },
      showMax  : false,
      showMin  : false,
      numDecimal  : 1,
      numInt  : 1,
      color  : this.embedWidgetColor,
      enableTimeout  : false,
      dataTimeout  : 5,
      ignoreZones  : false
    }
  }, {equal: isEqual});
  protected xteProperties = signal<IWidget>({
    type: "widget-numeric",
    uuid: "9234856b-7573-4154-a44f-3baf7c6f119c",
    config: {
      displayName: "XTE",
      filterSelfPaths: true,
      paths: {
        numericPath: {
          description: "Cross Track Error",
          path: "self.navigation.course.calcValues.crossTrackError",
          source: "default",
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "m",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        }
      },
      showMax: false,
      showMin: false,
      numDecimal: 1,
      numInt: 1,
      color: this.embedWidgetColor,
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    }
  }, {equal: isEqual});
  protected brgProperties = signal<IWidget>({
    type : "widget-numeric",
    uuid : "27a73083-3786-4399-847e-f08f32cb13bd",
    config : {
      displayName : "Locked BRG (Mag)",
      filterSelfPaths : true,
      paths : {
        numericPath : {
          description : "Numeric Data",
          path : "self.navigation.course.calcValues.bearingMagnetic",
          source : "default",
          pathType : "number",
          isPathConfigurable : false,
          convertUnitTo : "deg",
          showPathSkUnitsFilter : false,
          pathSkUnitsFilter : null,
          sampleTime : 500
        }
      },
      showMax : false,
      showMin : false,
      numDecimal : 0,
      numInt : 1,
      color : this.embedWidgetColor,
      enableTimeout : false,
      dataTimeout : 5,
      ignoreZones : false
    }
  }, {equal: isEqual});

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      paths: {
        "autopilotState": {
          description: "Autopilot State",
          path: 'self.steering.autopilot.state',
          source: 'default',
          pathType: "string",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          convertUnitTo: "",
          sampleTime: 500
        },
        "autopilotTargetHeading": {
          description: "Autopilot Target Magnetic Heading",
          path: 'self.steering.autopilot.target.headingMagnetic',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "autopilotTargetWindHeading": {
          description: "Autopilot Target Apparent Wind Angle",
          path: 'self.steering.autopilot.target.windAngleApparent',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        // "courseTargetHeadingTrue": {
        //   description: "Course Bearing True",
        //   path: 'self.navigation.course.calcValues.bearingTrue',
        //   source: 'default',
        //   pathType: "number",
        //   convertUnitTo: "deg",
        //   isPathConfigurable: false,
        //   showPathSkUnitsFilter: false,
        //   pathSkUnitsFilter: 'rad',
        //   sampleTime: 500
        // },
        // "courseTargetHeadingMag": {
        //   description: "Course Bearing Magnetic",
        //   path: 'self.navigation.course.calcValues.bearingMagnetic',
        //   source: 'default',
        //   pathType: "number",
        //   convertUnitTo: "deg",
        //   isPathConfigurable: false,
        //   showPathSkUnitsFilter: false,
        //   pathSkUnitsFilter: 'rad',
        //   sampleTime: 500
        // },
        "courseXte": {
          description: "Cross Track Error",
          path: "self.navigation.course.calcValues.crossTrackError",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          convertUnitTo: "m",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: 'm',
          sampleTime: 500
        },
        "rudderAngle": {
          description: "Rudder Angle",
          path: 'self.steering.rudderAngle',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          sampleTime: 500
        },
        "headingMag": {
          description: "Magnetic Heading",
          path: 'self.navigation.headingMagnetic',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          sampleTime: 500
        },
        "headingTrue": {
          description: "True Heading",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          sampleTime: 500
        },
        "windAngleApparent": {
          description: "Apparent Wind Angle",
          path: 'self.environment.wind.angleApparent',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          sampleTime: 500
        },
        "windAngleTrueWater": {
          description: "Wind Angle True Water",
          path: 'self.environment.wind.angleTrueWater',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          sampleTime: 500
        }
      },
      invertRudder: true,
      headingDirectionTrue: false,
      courseDirectionTrue: false,
      enableTimeout: false,
      dataTimeout: 5
    };

    const allMenuItems: MenuItem[] = [
      { label: 'Auto', action: 'auto' },
      { label: 'Wind', action: 'wind' },
      { label: 'Route', action: 'route' },
      { label: 'Close', action: 'cancel', isCancel: true }
    ];

    effect(() => {
      const mode = this.apState();

      untracked(() => {
        // Set enabled/disabled state for each mode menu item based
        this.menuItems = allMenuItems.map(item => {
          if (item.isCancel) return { ...item, current: false, disabled: false };
          let enabled = false;
          switch (mode) {
            case 'standby':
              enabled = (item.action === 'auto' || item.action === 'wind');
              break;
            case 'auto':
              enabled = (item.action === 'wind' || item.action === 'route');
              break;
            case 'wind':
              enabled = (item.action === 'auto');
              break;
            case 'route':
              enabled = (item.action === 'auto');
              break;
            default:
              enabled = false;
          }
          return {
            ...item,
            current: item.action === mode,
            disabled: !enabled
          };
        });

        switch (mode) {
          case 'off-line':
            this.modesBtn().disabled = true;
            this.engageBtn().disabled = true;
            this.plus1Btn().disabled = true;
            this.plus10Btn().disabled = true;
            this.minus1Btn().disabled = true;
            this.minus10Btn().disabled = true;
            this.prtTackBtn().disabled = true;
            this.stbTackBtn().disabled = true;
            this.advWptBtn().disabled = true;
            // this.dodgeBtn().disabled = true;
            break;
          case "standby":
            this.modesBtn().disabled = false;
            this.engageBtn().disabled = true;
            this.plus1Btn().disabled = true;
            this.plus10Btn().disabled = true;
            this.minus1Btn().disabled = true;
            this.minus10Btn().disabled = true;
            this.prtTackBtn().disabled = true;
            this.stbTackBtn().disabled = true;
            this.advWptBtn().disabled = true;
            // this.dodgeBtn().disabled = true;
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
            // this.dodgeBtn().disabled = true;
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
            // this.dodgeBtn().disabled = true;
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
            // this.dodgeBtn().disabled = false;
            break;
          default:
            this.modesBtn().disabled = true;
            this.engageBtn().disabled = true;
            this.plus1Btn().disabled = true;
            this.plus10Btn().disabled = true;
            this.minus1Btn().disabled = true;
            this.minus10Btn().disabled = true;
            this.prtTackBtn().disabled = true;
            this.stbTackBtn().disabled = true;
            this.advWptBtn().disabled = true;
            // this.dodgeBtn().disabled = true;
        }
        this.apGrid.set(mode ? 'grid' : 'none');
      });
    });
  }

  ngOnInit() {
    this.validateConfig();
    this.configureEmbedWidgets();
    this.startWidget();
  }

  private configureEmbedWidgets(): void {
    const brg = this.widgetProperties.config.courseDirectionTrue;
    this.brgProperties.update(prev => ({
      ...prev,
      config: {
        ...prev.config,
        paths: {
          ...prev.config.paths,
          numericPath: {
            ...prev.config.paths['numericPath'],
            path: brg ? "self.navigation.course.calcValues.bearingTrue" : "self.navigation.course.calcValues.bearingMagnetic",
          }
        },
        displayName: brg ? "Locked BRG (True)" : "Locked BRG (Mag)",
      }
    }));
  }

  protected startWidget(): void {
    this.startAllSubscriptions();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.configureEmbedWidgets();
    this.startAllSubscriptions();
  }

  private startAllSubscriptions(): void {
    this.unsubscribeDataStream();
    this.observeDataStream('autopilotState', newValue => this.apState.set(newValue.data.value));
    this.observeDataStream('autopilotTargetHeading', newValue => this.autopilotTargetHeading = newValue.data.value ? newValue.data.value : 0);
    this.observeDataStream('autopilotTargetWindHeading', newValue => this.autopilotTargetWindHeading = newValue.data.value ? newValue.data.value : 0);
    this.observeDataStream('courseXte', newValue => this.crossTrackError = newValue.data.value ? newValue.data.value : 0);
    this.observeDataStream('rudderAngle', newValue => {
        if (newValue.data.value === null) {
          this.rudder = 0;
        } else {
          this.rudder = this.widgetProperties.config.invertRudder ? -newValue.data.value : newValue.data.value;
        }
      }
    );
    // if (this.widgetProperties.config.courseDirectionTrue) {
    //   this.observeDataStream('courseTargetHeadingTrue', newValue => this.courseTargetHeading = newValue.data.value ? newValue.data.value : 0);
    // } else {
    //   this.observeDataStream('courseTargetHeadingMag', newValue => this.courseTargetHeading = newValue.data.value ? newValue.data.value : 0);
    // }
    if (this.widgetProperties.config.headingDirectionTrue) {
      this.observeDataStream('headingTrue', newValue => this.heading = newValue.data.value ? newValue.data.value : 0);
    } else {
      this.observeDataStream('headingMag', newValue => this.heading = newValue.data.value ? newValue.data.value : 0);
    }
    this.observeDataStream('windAngleApparent', newValue => this.windAngleApparent = newValue.data.value ? newValue.data.value : 0);
    this.subscribePutResponse();
  }

  private subscribePutResponse(): void {
    this.signalkRequestsService.subscribeRequest().pipe(takeUntilDestroyed(this._destroyRef)).subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        this.commandReceived(requestResult);
      }
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  protected onMenuItemClick(action: string): void {
    if (action === 'cancel') {
      this.toggleMenu();
      return;
    }
    this.buildAndSendCommand(action);
    this.menuOpen.set(false);
  }

  protected buildAndSendCommand(cmd: string) {
    const cmdAction = commands[cmd];
    if (typeof cmdAction === 'undefined') {
      alert('Unknown Autopilot command: ' + cmd);
      return null;
    }
    if ((this.actionToBeConfirmed !== '') && (this.actionToBeConfirmed !== cmd)) {
      this.clearConfirmCmd();
    }
    if (((cmd === 'tackToPort') || (cmd === 'tackToStarboard')) && (this.actionToBeConfirmed === '')) {
      this.confirmTack(cmd);
      return null;
    }
    if ((cmd === 'route') && (this.apState() === 'route') && (this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return null;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort') || (cmd === 'tackToStarboard')) {
        this.sendCommand(cmdAction);
      }
      if ((cmd === 'route') && (this.apState() === 'route')) {
        this.sendCommand(commands['advanceWaypoint']);
      }
      return null;
    }
    this.sendCommand(cmdAction);
  }

  private confirmAdvanceWaypoint(cmd: string): void {
    const message = "Repeat key [Adv Wpt] to confirm";
    this.startConfirmCmd(cmd, message);
  }

  private confirmTack(cmd: string): void {
    let direction = "";
    if (cmd === "tackToPort") {
      direction = "Port";
      this.actionToBeConfirmed = cmd;
    } else if (cmd === "tackToStarboard") {
      direction = "Starboard";
      this.actionToBeConfirmed = cmd;
    } else {
      this.actionToBeConfirmed = "";
      return null;
    }

    const message = `Repeat [Tack ${direction}] key to confirm`;
    this.startConfirmCmd(cmd, message);
  }

  private sendCommand(cmdAction: CommandDefinition): void {
    this.signalkRequestsService.putRequest(cmdAction["path"], cmdAction["value"], this.widgetProperties.uuid);
    console.log("AP Action:\n" + JSON.stringify(cmdAction));
  }

  private commandReceived(cmdResult: skRequest): void {
    if (cmdResult.statusCode != 200){
      this.displayApError(cmdResult);
    } else {
      console.log("AP Received: \n" + JSON.stringify(cmdResult));
    }
  }

  private startConfirmCmd(cmd: string, message: string): void {
    this.countDownValue = countDownDefault;
    this.actionToBeConfirmed = cmd;

    this.countdownOverlayText.set(message);
    this.countdownOverlayVisibility.set("visible");

    this.updateCountDownCounter(message);

    clearTimeout(this.handleConfirmActionTimeout);

    this.handleConfirmActionTimeout = setTimeout(() => {
      this.countdownOverlayVisibility.set("hidden");
      this.countdownOverlayText.set("");
      this.actionToBeConfirmed = "";
    }, 5000);
  }

  private clearConfirmCmd(): void {
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleCountDownCounterTimeout);
    this.countDownValue = -1;
    this.countdownOverlayVisibility.set("hidden");
    this.countdownOverlayText.set("");
    this.actionToBeConfirmed = '';
    return null;
  }

  private updateCountDownCounter(message: string): void {
    if (this.countDownValue > 0) {
      clearTimeout(this.handleCountDownCounterTimeout);
      this.countdownOverlayText.set(message);
      this.countDownValue -= 1;
      this.handleCountDownCounterTimeout = setTimeout(() => {
        this.updateCountDownCounter(message);
      }, 1000);
    } else {
      this.countDownValue = -1;
        clearTimeout(this.handleCountDownCounterTimeout);
    }
  }

  private displayApError(cmdResult: skRequest): void {
    let errMsg = cmdResult.statusCode + " - " + cmdResult.statusCodeDescription + ".";
    if (cmdResult.message){
      errMsg = errMsg + "Server Message: " + cmdResult.message + ".";
    }
    this.errorOverlayText.set(errMsg);
    this.errorOverlayVisibility.set("visible");

    clearTimeout(this.handleDisplayErrorTimeout);
    this.handleDisplayErrorTimeout = setTimeout(() => {
      this.errorOverlayVisibility.set("hidden");
      this.errorOverlayText.set("");
    }, 6000);
  }

  ngOnDestroy() {
   this.destroyDataStreams();
  }
}
