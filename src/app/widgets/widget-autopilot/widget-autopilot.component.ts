import { Component, OnInit, OnDestroy, viewChild, inject, signal, effect, untracked, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
import {
  IV2ApiEndpoints,
  IV2CommandResponse,
  IV2AutopilotsDiscoveryResponse,
  IV1CommandDefinition,
  V1CommandsMap
} from '../../core/interfaces/signalk-autopilot-interfaces';

// Shared constants for API paths and configuration
const API_PATHS = {
  V1_PLUGIN: 'autopilot',
  V2_BASE: '/signalk/v2/api',
  V2_VESSELS_SELF: '/signalk/v2/api/vessels/self',
  V2_AUTOPILOTS: '/signalk/v2/api/vessels/self/autopilots'
} as const;

const V2_ENDPOINT_TEMPLATES = {
  BASE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}`,
  ENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/engage`,
  DISENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/disengage`,
  MODE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/mode`,
  TARGET: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/target`,
  TACK: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/tack`,
  GYBE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/gybe`,
  DODGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/dodge`,
  ADJUST_HEADING: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/adjust-heading`
} as const;

const DEFAULTS = {
  AUTOPILOT_INSTANCE: '_default',
  COUNTDOWN_SECONDS: 5,
  ERROR_DISPLAY_DURATION: 6000,
  MESSAGE_DISPLAY_DURATION: 5000
} as const;

const commands: V1CommandsMap = {
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
  "advanceWaypoint":   {"path":"self.steering.autopilot.actions.advanceWaypoint","value":"1"},
  // V2 only commands (no V1 equivalent)
  "gybeToPort":   {"path":"v2:gybe","value":"port"},
  "gybeToStarboard":   {"path":"v2:gybe","value":"starboard"},
  "setAbsoluteTarget":   {"path":"v2:target","value":"absolute"},
  "dodge":   {"path":"v2:dodge","value":"engage"}
};

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
  private readonly http = inject(HttpClient);
  protected readonly dashboard = inject(DashboardService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _plugins = inject(SignalkPluginsService);
  protected readonly _app = inject(AppService);

  // API Version Detection
  protected apiVersion = signal<'v1' | 'v2' | null>(null);
  protected v2Endpoints = signal<IV2ApiEndpoints | null>(null);
  protected autopilotCapabilities = signal<string[]>([]);
  protected availableAutopilots = signal<string[]>([]);
  protected discoveryInProgress = signal<boolean>(false);
  protected apiDetectionError = signal<string | null>(null);

  // Request management
  private currentDiscoveryRequest?: Promise<void>;

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
  private handleCountDownCounterTimeout: ReturnType<typeof setTimeout> | null = null;
  private handleConfirmActionTimeout: ReturnType<typeof setTimeout> | null = null;
  private handleDisplayErrorTimeout: ReturnType<typeof setTimeout> | null = null;
  private handleMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private isPersistentError = false; // Track if current error should persist
  protected countDownValue = -1;
  private actionToBeConfirmed = "";

  // Mode Menu
  protected menuOpen = signal<boolean>(false);
  protected menuItems: MenuItem[] = [];
  protected readonly itemHeight = 60;
  protected readonly padding = 20;

  // Integrated widget properties
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
          path: "self.navigation.courseGreatCircle.nextPoint.position.longitude",
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
      dataTimeout: 5,
      autopilotInstance: DEFAULTS.AUTOPILOT_INSTANCE
    };

    const allMenuItems: MenuItem[] = [
      { label: 'Auto', action: 'auto' },
      { label: 'Wind', action: 'wind' },
      { label: 'Route', action: 'route' },
      { label: 'Close', action: 'cancel', isCancel: true }
    ];

    // API Version monitoring effect
    effect(() => {
      const version = this.apiVersion();

      untracked(() => {
        if (version) {
          const capabilities = this.autopilotCapabilities();
          if (version === 'v2') {
            const activeInstance = this.getActiveAutopilotInstance();
            const availableInstances = this.availableAutopilots();
            console.log(`[Autopilot Widget] API ${version} active - Instance: '${activeInstance}' | Available: [${availableInstances.join(', ')}] | Capabilities: [${capabilities.join(', ')}]`);
          } else {
            console.log(`[Autopilot Widget] API ${version} active with capabilities: [${capabilities.join(', ')}]`);
          }
        }
      });
    });

    // Button state management effect
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
          case null:
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
        this.apGrid.set(mode || mode === null ? 'grid' : 'none');
      });
    });
  }

  ngOnInit() {
    this.validateConfig();
    this.detectAutopilotApi().then(() => {
      this.startWidget();
    });
  }


  private async detectAutopilotApi(): Promise<void> {
    console.log('[Autopilot Widget] Starting API detection...');
    this.discoveryInProgress.set(true);
    this.apiDetectionError.set(null);

    try {
      // Try V2 API first - check for autopilots endpoint
      const v2Available = await this.checkV2Api();
      if (v2Available) {
        this.apiVersion.set('v2');
        await this.discoverV2Autopilots();
        await this.discoverV2Endpoints();
        console.log('[Autopilot Widget] V2 API detected with autopilots:', this.availableAutopilots());
        this.discoveryInProgress.set(false);

        // Clear any persistent error overlay from previous offline state
        this.errorOverlayVisibility.set('hidden');
        this.errorOverlayText.set('');
        this.isPersistentError = false;
        return;
      }
    } catch (error) {
      console.log('[Autopilot Widget] V2 API not available, checking V1...', error);
    }

    try {
      // Fall back to V1 plugin detection
      const v1Enabled = await this._plugins.isEnabled(API_PATHS.V1_PLUGIN);
      if (v1Enabled) {
        this.apiVersion.set('v1');
        this.autopilotCapabilities.set(['auto', 'wind', 'route', 'standby', 'tack']);
        console.log('[Autopilot Widget] V1 API detected');
        this.discoveryInProgress.set(false);

        this.errorOverlayVisibility.set('hidden');
        this.errorOverlayText.set('');
        this.isPersistentError = false;
        return;
      }
      console.log('[Autopilot Widget] V1 API plugin (signalk-autopilot) not found')
    } catch (error) {
      console.error('[Autopilot Widget] V1 plugin detection failed:', error);
      this.apiDetectionError.set(`V1 detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // No API available
    console.warn('[Autopilot Widget] No Autopilot detected');
    this.apState.set('off-line');
    this.apiDetectionError.set('[Autopilot Widget] No autopilot API available');

    this.errorOverlayText.set('No Autopilot detected');
    this.errorOverlayVisibility.set('visible');
    this.isPersistentError = true;
    this.discoveryInProgress.set(false);
  }

  private async checkV2Api(): Promise<boolean> {
    try {
      const response = await this.http.get(API_PATHS.V2_AUTOPILOTS, {
        observe: 'response',
        responseType: 'json'
      }).toPromise();
      return response?.status === 200;
    } catch (error) {
      // Differentiate between network errors and 404s
      if (error && typeof error === 'object' && 'status' in error) {
        const httpError = error as {status: number, statusText?: string};
        if (httpError.status === 404) {
          console.log('[Autopilot Widget] V2 API endpoint not found (404)');
        } else if (httpError.status >= 500) {
          console.warn('[Autopilot Widget] V2 API server error:', httpError.status, httpError.statusText);
        } else {
          console.log('[Autopilot Widget] V2 API error:', httpError.status, httpError.statusText);
        }
      } else {
        console.log('[Autopilot Widget] V2 API network error:', error);
      }
      return false;
    }
  }

  private async discoverV2Autopilots(): Promise<void> {
    try {
      const response = await this.http.get<IV2AutopilotsDiscoveryResponse>(API_PATHS.V2_AUTOPILOTS).toPromise();

      // Extract autopilot instance IDs from the response
      const autopilotIds = Object.keys(response || {});
      this.availableAutopilots.set(autopilotIds);

      console.log('[Autopilot Widget] Discovered V2 autopilot instances:', autopilotIds);

      // If configured instance is not available, fall back to first available or default
      const configuredInstance = this.widgetProperties.config.autopilotInstance || DEFAULTS.AUTOPILOT_INSTANCE;
      if (autopilotIds.length > 0 && !autopilotIds.includes(configuredInstance)) {
        console.warn(`[Autopilot Widget] Configured instance '${configuredInstance}' not found, using '${autopilotIds[0]}'`);
      }
    } catch (error) {
      console.error('[Autopilot Widget] Failed to discover V2 autopilots:', error);
      // Set default if discovery fails - don't throw to avoid breaking widget
      this.availableAutopilots.set([DEFAULTS.AUTOPILOT_INSTANCE]);
      this.apiDetectionError.set(`Failed to discover autopilots: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with defaults instead of throwing
    }
  }

  private async discoverV2Endpoints(): Promise<void> {
    try {
      // Determine which autopilot instance to use
      const configuredInstance = this.widgetProperties.config.autopilotInstance || DEFAULTS.AUTOPILOT_INSTANCE;
      const availableInstances = this.availableAutopilots();

      let targetInstance = configuredInstance;
      if (availableInstances.length > 0 && !availableInstances.includes(configuredInstance)) {
        targetInstance = availableInstances[0];
        console.warn(`[Autopilot Widget] Using '${targetInstance}' instead of configured '${configuredInstance}'`);
      }

      // Try to get endpoint definitions from the specific instance
      let response: {endpoints?: Partial<IV2ApiEndpoints>, capabilities?: string[]} | undefined;
      try {
        response = await this.http.get<{endpoints?: Partial<IV2ApiEndpoints>, capabilities?: string[]}>(
          V2_ENDPOINT_TEMPLATES.BASE(targetInstance)
        ).toPromise();
      } catch {
        console.log(`[Autopilot Widget] No endpoint discovery available for instance '${targetInstance}', using defaults`);
      }

      // Build endpoint URLs using the target instance
      const endpoints: IV2ApiEndpoints = {
        engage: response?.endpoints?.engage || V2_ENDPOINT_TEMPLATES.ENGAGE(targetInstance),
        disengage: response?.endpoints?.disengage || V2_ENDPOINT_TEMPLATES.DISENGAGE(targetInstance),
        mode: response?.endpoints?.mode || V2_ENDPOINT_TEMPLATES.MODE(targetInstance),
        target: response?.endpoints?.target || V2_ENDPOINT_TEMPLATES.TARGET(targetInstance),
        tack: response?.endpoints?.tack || V2_ENDPOINT_TEMPLATES.TACK(targetInstance),
        gybe: response?.endpoints?.gybe || V2_ENDPOINT_TEMPLATES.GYBE(targetInstance),
        dodge: response?.endpoints?.dodge || V2_ENDPOINT_TEMPLATES.DODGE(targetInstance),
        adjustHeading: response?.endpoints?.adjustHeading || V2_ENDPOINT_TEMPLATES.ADJUST_HEADING(targetInstance)
      };

      this.v2Endpoints.set(endpoints);
      this.autopilotCapabilities.set(response?.capabilities || ['auto', 'wind', 'route', 'standby', 'tack', 'gybe', 'dodge']);

      console.log(`[Autopilot Widget] V2 endpoints configured for instance '${targetInstance}':`, endpoints);
    } catch (error) {
      console.error('[Autopilot Widget] Failed to discover V2 endpoints:', error);
      // Don't throw - fall back to defaults to avoid breaking the widget
      const targetInstance = this.getActiveAutopilotInstance();
      const fallbackEndpoints: IV2ApiEndpoints = {
        engage: V2_ENDPOINT_TEMPLATES.ENGAGE(targetInstance),
        disengage: V2_ENDPOINT_TEMPLATES.DISENGAGE(targetInstance),
        mode: V2_ENDPOINT_TEMPLATES.MODE(targetInstance),
        target: V2_ENDPOINT_TEMPLATES.TARGET(targetInstance),
        tack: V2_ENDPOINT_TEMPLATES.TACK(targetInstance),
        gybe: V2_ENDPOINT_TEMPLATES.GYBE(targetInstance),
        dodge: V2_ENDPOINT_TEMPLATES.DODGE(targetInstance),
        adjustHeading: V2_ENDPOINT_TEMPLATES.ADJUST_HEADING(targetInstance)
      };
      this.v2Endpoints.set(fallbackEndpoints);
      this.autopilotCapabilities.set(['auto', 'wind', 'route', 'standby', 'tack', 'gybe', 'dodge']);
      console.log(`[Autopilot Widget] Using fallback V2 endpoints for instance '${targetInstance}'`);
    }
  }

  private getActiveAutopilotInstance(): string {
    const configuredInstance = this.widgetProperties.config.autopilotInstance || DEFAULTS.AUTOPILOT_INSTANCE;
    const availableInstances = this.availableAutopilots();

    // If V2 API and instance not available, use first available
    if (this.apiVersion() === 'v2' && availableInstances.length > 0 && !availableInstances.includes(configuredInstance)) {
      return availableInstances[0];
    }

    return configuredInstance;
  }

  // not used for not - get AP details from API
  protected getAutopilotInfo(): {
    apiVersion: 'v1' | 'v2' | null;
    activeInstance: string;
    availableInstances: string[];
    capabilities: string[];
    isConfiguredInstanceAvailable: boolean;
  } {
    const configuredInstance = this.widgetProperties.config.autopilotInstance || DEFAULTS.AUTOPILOT_INSTANCE;
    const availableInstances = this.availableAutopilots();
    const activeInstance = this.getActiveAutopilotInstance();

    return {
      apiVersion: this.apiVersion(),
      activeInstance,
      availableInstances,
      capabilities: this.autopilotCapabilities(),
      isConfiguredInstanceAvailable: this.apiVersion() === 'v1' || availableInstances.includes(configuredInstance)
    };
  }

  protected isV2CommandSupported(command: string): boolean {
    return this.apiVersion() === 'v2' && this.autopilotCapabilities().includes(command);
  }

  protected startWidget(): void {
    this.startAllSubscriptions();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    const previousInstance = this.widgetProperties.config.autopilotInstance;
    this.widgetProperties.config = config;

    // Cancel any ongoing discovery
    this.currentDiscoveryRequest = undefined;

    // If autopilot instance changed and we're using V2 API, re-discover endpoints
    const newInstance = config.autopilotInstance;
    if (this.apiVersion() === 'v2' && previousInstance !== newInstance) {
      console.log(`[Autopilot Widget] Autopilot instance changed from '${previousInstance}' to '${newInstance}', re-discovering endpoints`);
      this.discoveryInProgress.set(true);
      this.apiDetectionError.set(null);

      this.currentDiscoveryRequest = this.discoverV2Endpoints().catch(error => {
        console.error('[Autopilot Widget] Failed to re-discover V2 endpoints after config change:', error);
        this.apiDetectionError.set(`Failed to re-discover endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }).finally(() => {
        this.discoveryInProgress.set(false);
      });
    }

    this.startAllSubscriptions();
  }

  private startAllSubscriptions(): void {
    this.unsubscribeDataStream();

    // Only subscribe to autopilot state if we have a valid API
    if (this.apiVersion()) {
      this.observeDataStream('autopilotState', newValue => {
        if (newValue.data?.value) {
          this.apState.set(newValue.data.value);
          console.warn(`[Autopilot Widget] Autopilot state updated: ${newValue.data.value}`);
        } else {
          this.apState.set('off-line');
          console.warn('[Autopilot Widget] Autopilot state is null or not available');
        }
      });
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
    }
    if (this.apiVersion() === 'v1') {
      // Subscribe to V1 autopilot state changes
      this.subscribePutResponse();
    }
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
        const direction = cmd === 'tackToPort' ? 'port' : 'starboard';
        this.performTack(direction);
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

  private sendCommand(cmdAction: IV1CommandDefinition): void {
    if (this.apiVersion() === 'v2' && cmdAction.path.startsWith('v2:')) {
      // Check if V2 command is supported before sending
      const commandType = cmdAction.path.split(':')[1];
      if (!this.isV2CommandSupported(commandType)) {
        console.warn(`[Autopilot Widget] Command '${commandType}' not supported by current autopilot instance`);
        this.displayApError({
          statusCode: 400,
          statusCodeDescription: 'Command Not Supported',
          message: `Command '${commandType}' is not supported by the current autopilot instance`,
          widgetUUID: this.widgetProperties.uuid
        } as skRequest);
        return;
      }
      this.sendV2Command(cmdAction);
    } else {
      // V1 command
      this.signalkRequestsService.putRequest(cmdAction["path"], cmdAction["value"], this.widgetProperties.uuid);
      console.log("AP Action:\n" + JSON.stringify(cmdAction));
    }
  }

  private async sendV2Command(cmdAction: IV1CommandDefinition): Promise<void> {
    const endpoints = this.v2Endpoints();
    if (!endpoints) {
      console.error('V2 endpoints not available');
      return;
    }

    try {
      let response: IV2CommandResponse | unknown;

      switch (cmdAction.path) {
        case 'v2:gybe':
          response = await this.http.post(`${endpoints.gybe}/${cmdAction.value}`, {}).toPromise();
          break;
        case 'v2:target':
          // For absolute target, value should be the heading
          response = await this.http.put(endpoints.target, {
            mode: 'absolute',
            value: cmdAction.value
          }).toPromise();
          break;
        case 'v2:dodge':
          response = await this.http.post(endpoints.dodge, {
            action: cmdAction.value
          }).toPromise();
          break;
        default:
          console.error('Unknown V2 command:', cmdAction.path);
          return;
      }

      console.log('V2 AP Action:', response);
    } catch (error) {
      console.error('V2 command failed:', error);
      this.displayApError({
        statusCode: 500,
        statusCodeDescription: 'V2 Command Failed',
        message: `Failed to execute ${cmdAction.path}`,
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  // Enhanced tacking with V2 support
  private async performTack(direction: 'port' | 'starboard'): Promise<void> {
    if (this.apiVersion() === 'v2') {
      const endpoints = this.v2Endpoints();
      const activeInstance = this.getActiveAutopilotInstance();

      if (endpoints) {
        try {
          console.log(`[Autopilot Widget] Executing V2 tack to ${direction} on instance '${activeInstance}'`);
          const response = await this.http.post(`${endpoints.tack}/${direction}`, {}).toPromise();
          console.log(`[Autopilot Widget] V2 Tack Response from '${activeInstance}':`, response);
        } catch (error) {
          console.error(`[Autopilot Widget] V2 tack failed on instance '${activeInstance}':`, error);
          this.displayApError({
            statusCode: 500,
            statusCodeDescription: 'V2 Tack Failed',
            message: `Failed to tack to ${direction} on autopilot '${activeInstance}'`,
            widgetUUID: this.widgetProperties.uuid
          } as skRequest);
        }
      }
    } else {
      // Fall back to V1
      console.log(`[Autopilot Widget] Executing V1 tack to ${direction}`);
      const cmdAction = commands[direction === 'port' ? 'tackToPort' : 'tackToStarboard'];
      this.signalkRequestsService.putRequest(cmdAction.path, cmdAction.value, this.widgetProperties.uuid);
    }
  }

  // V2 Gybe Methods (class only - no UI yet)
  protected async gybeToPort(): Promise<void> {
    if (this.apiVersion() === 'v2') {
      await this.sendV2Command(commands.gybeToPort);
    } else {
      console.warn('[Autopilot Widget] Gybe only available in V2 API');
      this.displayApError({
        statusCode: 400,
        statusCodeDescription: 'V2 API Required',
        message: 'Gybe only available in V2 API',
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  protected async gybeToStarboard(): Promise<void> {
    if (this.apiVersion() === 'v2') {
      await this.sendV2Command(commands.gybeToStarboard);
    } else {
      console.warn('[Autopilot Widget] Gybe only available in V2 API');
      this.displayApError({
        statusCode: 400,
        statusCodeDescription: 'V2 API Required',
        message: 'Gybe only available in V2 API',
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  // V2 Absolute Target Method (class only - no UI yet)
  protected async setAbsoluteTarget(heading: number): Promise<void> {
    if (this.apiVersion() === 'v2') {
      const targetCommand: IV1CommandDefinition = {
        path: 'v2:target',
        value: heading
      };
      await this.sendV2Command(targetCommand);
    } else {
      console.warn('[Autopilot Widget] Absolute target only available in V2 API');
      this.displayApError({
        statusCode: 400,
        statusCodeDescription: 'V2 API Required',
        message: 'Absolute target only available in V2 API',
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  // V2 Dodge Method (class only - no UI yet)
  protected async engageDodge(): Promise<void> {
    if (this.apiVersion() === 'v2') {
      await this.sendV2Command(commands.dodge);
    } else {
      console.warn('[Autopilot Widget] Dodge mode only available in V2 API');
      this.displayApError({
        statusCode: 400,
        statusCodeDescription: 'V2 API Required',
        message: 'Dodge mode only available in V2 API',
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  private commandReceived(cmdResult: skRequest): void {
    if (cmdResult.statusCode != 200){
      this.displayApError(cmdResult);
    } else {
      console.log("AP Received: \n" + JSON.stringify(cmdResult));
    }
  }

  private startConfirmCmd(cmd: string, message: string): void {
    this.countDownValue = DEFAULTS.COUNTDOWN_SECONDS;
    this.actionToBeConfirmed = cmd;

    this.countdownOverlayText.set(message);
    this.countdownOverlayVisibility.set("visible");

    this.updateCountDownCounter(message);

    clearTimeout(this.handleConfirmActionTimeout);

    this.handleConfirmActionTimeout = setTimeout(() => {
      this.countdownOverlayVisibility.set("hidden");
      this.countdownOverlayText.set("");
      this.actionToBeConfirmed = "";
    }, DEFAULTS.MESSAGE_DISPLAY_DURATION);
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
    // Don't override persistent offline errors with temporary command errors
    if (this.isPersistentError) {
      console.warn('[Autopilot Widget] Skipping temporary error display - persistent error active:', cmdResult.statusCodeDescription);
      return;
    }

    let errMsg = cmdResult.statusCode + " - " + cmdResult.statusCodeDescription + ".";
    if (cmdResult.message){
      errMsg = errMsg + "Server Message: " + cmdResult.message + ".";
    }
    this.errorOverlayText.set(errMsg);
    this.errorOverlayVisibility.set("visible");

    clearTimeout(this.handleDisplayErrorTimeout);
    this.handleDisplayErrorTimeout = setTimeout(() => {
      // Only hide if it's not a persistent error
      if (!this.isPersistentError) {
        this.errorOverlayVisibility.set("hidden");
        this.errorOverlayText.set("");
      }
    }, DEFAULTS.ERROR_DISPLAY_DURATION);
  }

  ngOnDestroy() {
    // Cancel any ongoing discovery requests
    this.currentDiscoveryRequest = undefined;

    // Clear any pending timeouts
    clearTimeout(this.handleCountDownCounterTimeout);
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleDisplayErrorTimeout);
    clearTimeout(this.handleMessageTimeout);

    // Clear persistent error flag
    this.isPersistentError = false;

    // Clean up data streams
    this.destroyDataStreams();
  }
}
