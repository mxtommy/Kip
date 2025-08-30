/**
 * Autopilot Widget Component
 *
 * A comprehensive autopilot control widget that supports both Signal K V1 (plugin-based)
 * and V2 (REST API-based) autopilot systems. Provides intuitive controls for autopilot
 * modes, heading adjustments, tacking, and route navigation.
 *
 * Features:
 * - Automatic API version detection (V1/V2)
 * - Dynamic endpoint discovery for V2 systems
 * - Mixed environment support (V2 preferred, V1 fallback)
 * - Comprehensive error handling and user feedback
 * - Promise-based state management for V2 operations
 * - Confirmation dialogs for critical operations (tack, waypoint advance)
 *
 * Supported Autopilot Operations:
 * - Mode switching (auto, wind, route, standby)
 * - Heading adjustments (±1°, ±10°)
 * - Tacking (port/starboard with confirmation)
 * - Waypoint advancement with confirmation
 * - V2-only: Absolute target heading, dodge mode
 *
 * @requires HttpClient, Angular Signals
 */
import { Component, OnInit, OnDestroy, inject, signal, untracked, DestroyRef, computed, linkedSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
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
import { lastValueFrom, Observable, finalize } from 'rxjs';
import {
  IV2CommandDefinition,
  IV2CommandResponse,
  IV1CommandDefinition,
  V1CommandsMap,
  IV2ApiEndpoints,
  TApMode
} from '../../core/interfaces/signalk-autopilot-interfaces';

interface MenuItem {
  label: string;
  action: string;
  current?: boolean;
  isCancel?: boolean;
  disabled?: boolean;
}

// Shared constants for API paths and configuration
const API_PATHS = {
  V1_MODE_PATH: 'self.steering.autopilot.state',
  V2_BASE: '/signalk/v2/api',
  V2_AUTOPILOTS: '/signalk/v2/api/vessels/self/autopilots',
  V2_COURSE: '/signalk/v2/api/vessels/self/navigation/course'
} as const;

const V2_ENDPOINT_TEMPLATES: Record<string, (instance: string) => string> = {
  BASE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}`,
  ENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/engage`,
  DISENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/disengage`,
  STATE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/state`,
  MODE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/mode`,
  TARGET_HEADING: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/target`,
  TACK: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/tack`,
  GYBE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/gybe`,
  DODGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/dodge`,
  ADJUST_HEADING: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/target/adjust`,
};

const COMMANDS: V1CommandsMap = {
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
  // V2-only commands
  "compass":   {"path": "v2 only command", "value": "v2 only command"},
  "gps":   {"path": "v2 only command", "value": "v2 only command"},
  "true wind":   {"path": "v2 only command", "value": "v2 only command"},
  "nav":   {"path": "v2 only command", "value": "v2 only command"},
} as const;

const DEFAULTS = {
  COUNTDOWN_SECONDS: 5,
  ERROR_DISPLAY_DURATION: 6000,
  MESSAGE_DISPLAY_DURATION: 5000
} as const;

@Component({
    selector: 'widget-autopilot',
    templateUrl: './widget-autopilot.component.html',
    styleUrls: ['./widget-autopilot.component.scss'],
    imports: [WidgetHostComponent, SvgAutopilotComponent, MatButtonModule, TitleCasePipe, MatIconModule, MatBadgeModule, WidgetPositionComponent, WidgetNumericComponent, WidgetDatetimeComponent],
})
export class WidgetAutopilotComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private readonly _requests = inject(SignalkRequestsService);
  private readonly http = inject(HttpClient);
  protected readonly dashboard = inject(DashboardService);
  private readonly _destroyRef = inject(DestroyRef);

  private apiEndpoints: IV2ApiEndpoints;

  // Autopilot state Management
  protected apState = signal<string | null>(null);
  protected apEngaged = signal<boolean | null>(null);
  protected apMode = signal<TApMode | null>(null);
  protected dodgeModeActive = signal<boolean>(false);
  protected autopilotTargetHeading = signal<number | null>(null);
  protected autopilotTargetWindHeading = signal<number | null>(null);
  protected heading = signal<number | null>(null);
  protected crossTrackError = signal<number | null>(null);
  protected windAngleApparent = signal<number | null>(null);
  protected rudder = signal<number | null>(null);

  protected autopilotTarget = linkedSignal<number | null>(() => {
    const v1Heading = this.autopilotTargetHeading();
    const v1Wind = this.autopilotTargetWindHeading();

    if (this.apMode() === 'wind') {
      return v1Wind ?? null;
    }

    return v1Heading ?? null;
  });

  // Request management
  private currentRequests = new Set<Observable<unknown>>();

  // Keypad buttons & layout
  protected apGrid = computed(() => this.apMode() ? 'grid' : 'none');

  protected readonly apEngageBtnDisabled = computed(() => {
    const state = this.apState();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const engaged = this.apEngaged();
    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;

    if (!apiVersion) return true;

    if (apiVersion === "v1") {
      return (['standby', 'off-line'].includes(state)) ? true : false;
    }

    if (apiVersion === "v2") {
      return false;
    }
    return true;
  });

  protected readonly apBtnDisabled = computed(() => {
    const engaged = this.apEngaged();
    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;

    if (apiVersion === "v1") {
      return this.apMode() === 'standby' ? true : false;
    }
    if ( engaged ) {
      return false;
    }
    return true;
  });
  protected readonly adjustHdgBtnVisibility = computed(() => {
    const mode = this.apMode();
    if ( ['auto', 'compass', 'gps', 'wind', 'true wind', 'standby'].includes(mode)) {
      return true;
    }
    return false;
  });
  protected readonly tackBtnVisibility = computed(() => {
    const mode = this.apMode();
    if ( ['auto', 'compass', 'gps', 'wind', 'true wind', 'standby'].includes(mode)) {
      return true;
    }
    return false;
  });
  protected readonly routeBtnVisibility = computed(() => {
    const mode = this.apMode();
    if ( mode === 'route' ||  mode === 'nav') {
      return true;
    }
    return false;
  });

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
  protected menuItems = computed<MenuItem[]>(() => {
    const mode = this.apMode();
    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;
    const plugin = this.widgetProperties.config.autopilot.pluginId;
    let menuItems: MenuItem[] = [];

    untracked(() => {
      if (apiVersion === 'v2') {
        if (plugin == 'pypilot-autopilot-provider') {
          const allAPModes: MenuItem[] = [
            { label: 'Compass', action: 'compass' },
            { label: 'GPS', action: 'gps' },
            { label: 'Wind', action: 'wind' },
            { label: 'True Wind', action: 'true wind' },
            { label: 'Navigation', action: 'nav' },
            { label: 'Close', action: 'cancel', isCancel: true }
          ];
          menuItems = this.parseMenuItems(allAPModes, mode);
        }
      } else if (apiVersion === 'v1') {
        const allAPModes: MenuItem[] = [
          { label: 'Auto', action: 'auto' },
          { label: 'Wind', action: 'wind' },
          { label: 'Route', action: 'route' },
          { label: 'Close', action: 'cancel', isCancel: true }
        ];
        menuItems = this.parseMenuItems(allAPModes, mode);
      }
    });
    return menuItems;
  });
  protected menuOpen = signal<boolean>(false);
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
      showMiniChart: false,
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
      showMiniChart: false,
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
      showMiniChart: false,
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
          path: "self.steering.autopilot.state",
          source: "default",
          pathType: "string",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          convertUnitTo: "",
          sampleTime: 500
        },
        "autopilotMode": {
          description: "Autopilot Mode",
          path: "self.steering.autopilot.mode",
          source: "default",
          pathType: "string",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          convertUnitTo: "",
          sampleTime: 500
        },
        "autopilotEngaged": {
          description: "Autopilot Engaged",
          path: 'self.steering.autopilot.engaged',
          source: 'default',
          pathType: "boolean",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          convertUnitTo: "",
          sampleTime: 500
        },
        "autopilotV2Target": {
          description: "Autopilot API v2 Target",
          path: 'self.steering.autopilot.target',
          source: 'default',
          pathType: "number",
          convertUnitTo: "deg",
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
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
        "courseXte": {
          description: "Cross Track Error",
          path: "self.navigation.course.calcValues.crossTrackError",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          convertUnitTo: "m",
          showPathSkUnitsFilter: true,
          pathRequired: false,
          pathSkUnitsFilter: 'm',
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
      autopilot : { // Will be set during API detection in widget Options
        invertRudder: true,
        headingDirectionTrue: false,
        courseDirectionTrue: false,
        apiVersion: null,
        instanceId: null,
        pluginId: null,
        modes: null // Default modes for V1
      },
      enableTimeout: false,
      dataTimeout: 5,
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    const err: skRequest = {
      statusCode: 500,
      statusCodeDescription: 'Autopilot widget not configured',
      requestId: '',
      state: ''
    };

    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;
    const instanceId = this.widgetProperties.config.autopilot.instanceId;
    const pluginId = this.widgetProperties.config.autopilot.pluginId;

    // Helper for persistent error state
    const setPersistentError = (message: string) => {
      this.unsubscribeDataStream();
      console.error(`[Autopilot Widget] ${message}`);
      this.displayApError(err);
      this.isPersistentError = true;
      this.apMode.set('off-line');
      this.apState.set('off-line');
      this.apEngaged.set(false);
    };

    this.unsubscribeDataStream();

    if (!apiVersion) {
      setPersistentError('Not configured with autopilot API version, skipping initialization');
      return;
    }

    if (apiVersion === 'v2') {
      if (!instanceId) {
        setPersistentError('No autopilot instance ID configured for V2 API, skipping initialization');
        return;
      }
      if (!pluginId) {
        setPersistentError('No autopilot plugin ID configured for V2 API, skipping initialization');
        return;
      }
      this.apiEndpoints = this.setV2Endpoint(instanceId);
      this.startV2Subscriptions();
      return;
    }

    if (apiVersion === 'v1') {
      this.startV1Subscriptions();
      return;
    }

    // Unknown API version
    setPersistentError(`Unknown autopilot API version: ${apiVersion}`);
  }

  private setV2Endpoint(instanceId: string): IV2ApiEndpoints {
    const endpoints: IV2ApiEndpoints = {
      engage: V2_ENDPOINT_TEMPLATES.ENGAGE(instanceId),
      disengage: V2_ENDPOINT_TEMPLATES.DISENGAGE(instanceId),
      mode: V2_ENDPOINT_TEMPLATES.MODE(instanceId),
      state: V2_ENDPOINT_TEMPLATES.STATE(instanceId),
      target: V2_ENDPOINT_TEMPLATES.TARGET_HEADING(instanceId),
      tack: V2_ENDPOINT_TEMPLATES.TACK(instanceId),
      gybe: V2_ENDPOINT_TEMPLATES.GYBE(instanceId),
      dodge: V2_ENDPOINT_TEMPLATES.DODGE(instanceId),
      adjustHeading: V2_ENDPOINT_TEMPLATES.ADJUST_HEADING(instanceId)
    };
    return endpoints;
  }

  protected isV2CommandSupported(command: string): boolean {
    return this.widgetProperties.config.autopilot.modes.includes(command);
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    // Cancel any ongoing HTTP requests
    this.cancelAllHttpRequests();

    // Clear any error or message overlays
    this.isPersistentError = false;
    this.errorOverlayVisibility.set("hidden");
    this.errorOverlayText.set("");
    this.apEngaged.set(null);

    this.startWidget();
  }

  private startV2Subscriptions(): void {
    this.observeDataStream('autopilotState', newValue => {
      if (newValue.data?.value) {
        this.apState.set(newValue.data.value);
      } else {
        this.apState.set('off-line');
        console.warn('[Autopilot Widget] Autopilot state is null or not available');
      }
    });
    this.observeDataStream('autopilotMode', newValue => {
      if (newValue.data?.value) {
        this.apMode.set(newValue.data.value);
      } else {
        this.apMode.set('off-line');
        console.warn('[Autopilot Widget] Autopilot mode is null or not available');
      }
    });
    this.observeDataStream('autopilotEngaged', newValue => {
      if (newValue.data?.value != null) {
        this.apEngaged.set(newValue.data.value as boolean);
      } else {
        this.apEngaged.set(false);
        console.warn('[Autopilot Widget] Autopilot engaged is null or not available');
      }
    });
    this.observeDataStream('autopilotV2Target', newValue => {
      if (newValue.data?.value) {
        this.autopilotTarget.set(newValue.data.value);
      } else {
        this.autopilotTarget.set(null);
        console.warn('[Autopilot Widget] Autopilot V2 target is null or not available');
      }
    });

    this.startDataSubscription();
  }

  private startV1Subscriptions(): void {
    // For V1, we use this single legacy path
    this.widgetProperties.config.paths['autopilotMode'].path = API_PATHS.V1_MODE_PATH;
    this.observeDataStream('autopilotMode', newValue => {
      if (newValue.data?.value) {
        this.apMode.set(newValue.data.value);
      } else {
        this.apMode.set('off-line');
        console.warn('[Autopilot Widget] Autopilot V1 mode state is null or not available');
      }
    });
    this.observeDataStream('autopilotTargetHeading', newValue => this.autopilotTargetHeading.set(newValue.data.value != null ? newValue.data.value : 0));
    this.observeDataStream('autopilotTargetWindHeading', newValue => this.autopilotTargetWindHeading.set(newValue.data.value != null ? newValue.data.value : 0));

    this.startDataSubscription();

    // Subscribe to V1 autopilot PUT state changes
    this.subscribePutResponse();
    // Not used in V1, but needed for UI state management
    this.apState.set(null);
  }

  private startDataSubscription(): void {
    this.observeDataStream('courseXte', newValue => this.crossTrackError.set(newValue.data.value != null ? newValue.data.value : 0));
    this.observeDataStream('rudderAngle', newValue => {
        if (newValue.data.value === null) {
          this.rudder.set(null);
        } else {
          this.rudder.set(this.widgetProperties.config.autopilot.invertRudder ? -newValue.data.value : newValue.data.value);
        }
      }
    );

    if (this.widgetProperties.config.autopilot.headingDirectionTrue) {
      this.observeDataStream('headingTrue', newValue => this.heading.set(newValue.data.value != null ? newValue.data.value : 0));
    } else {
      this.observeDataStream('headingMag', newValue => this.heading.set(newValue.data.value != null ? newValue.data.value : 0));
    }

    this.observeDataStream('windAngleApparent', newValue => this.windAngleApparent.set(newValue.data.value != null ? newValue.data.value : 0));
  }

  private subscribePutResponse(): void {
    this._requests.subscribeRequest().pipe(takeUntilDestroyed(this._destroyRef)).subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        this.commandReceived(requestResult);
      }
    });
  }

  /**
   * Creates a managed HTTP request with automatic cancellation and tracking
   * @param observable The HTTP Observable to manage
   * @returns Observable with takeUntilDestroyed and tracking
   */
  private makeHttpRequest<T>(observable: Observable<T>): Observable<T> {
    const request = observable.pipe(takeUntilDestroyed(this._destroyRef));
    this.currentRequests.add(request);

    return request.pipe(
      finalize(() => this.currentRequests.delete(request))
    );
  }

  /**
   * Cancels all ongoing HTTP requests
   */
  private cancelAllHttpRequests(): void {
    // Observables with takeUntilDestroyed() auto-cancel, just clear tracking
    this.currentRequests.clear();
  }

  protected buildAndSendCommand(cmd: string): void {
    const cmdAction = COMMANDS[cmd];
    if (typeof cmdAction === 'undefined') {
      alert('Unknown Autopilot command: ' + cmd);
      return;
    }
    if ((this.actionToBeConfirmed !== '') && (this.actionToBeConfirmed !== cmd)) {
      this.clearConfirmCmd();
    }
    if (((cmd === 'tackToPort') || (cmd === 'tackToStarboard')) && (this.actionToBeConfirmed === '')) {
      this.confirmTack(cmd);
      return;
    }
    if ( ((cmd === 'route' && this.apMode() === 'route') || (cmd === 'route' && this.apMode() === 'nav')) && (this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort') || (cmd === 'tackToStarboard')) {
        const direction = cmd === 'tackToPort' ? 'port' : 'starboard';
        this.performTackOrGybe('tack', direction);
      }
      if ( (cmd === 'route' && this.apMode() === 'route') || (cmd === 'route' && this.apMode() === 'nav') ) {
        this.routeCommand(cmd, COMMANDS['advanceWaypoint']);
      }
      return;
    }
    this.routeCommand(cmd, cmdAction);
  }

  private routeCommand(cmd: string, cmdAction: IV1CommandDefinition): void {
    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;
    if (apiVersion === 'v2') {
      if (cmd === 'route' && this.apMode() === 'nav') {
        cmd = 'advanceWaypoint';
      }
      this.sendV2Command(cmd);
    } else if (apiVersion === 'v1' && !cmdAction.path.startsWith('v2:')) {
      // V1 command
      this.sendV1Command(cmdAction);
    } else {
      console.error('[Autopilot Widget] Unsupported basic command:', cmdAction.path);
      this.displayApError({
        statusCode: 400,
        statusCodeDescription: 'Unsupported Command',
        message: `Command path '${cmdAction.path}' is not supported in the current API version`,
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);
    }
  }

  private sendV1Command(cmdAction: IV1CommandDefinition): void {
    this._requests.putRequest(cmdAction["path"], cmdAction["value"], this.widgetProperties.uuid);
    console.log("AP Action:\n" + JSON.stringify(cmdAction));
  }

  /**
   * Executes V2 autopilot commands using REST endpoints
   *
   * Special Handling:
   * - Dodge mode: Toggles between POST (activate) and DELETE (deactivate)
   * - Tack/Gybe: Appends direction to endpoint path
   * - State tracking: Updates dodgeModeActive signal on successful dodge operations
   *
   * @param cmd V2 command identifier
   * @param cmdAction Optional V1 command for compatibility (unused in V2)
   * @param value Optional command value (direction for tack/gybe, heading for target)
   */
  private async sendV2Command(cmd: string, value?: object): Promise<void> {
    const endpoints = this.apiEndpoints;
    if (!endpoints) {
      console.error('V2 endpoints not available');
      return;
    }

    const dodge = this.dodgeModeActive();
    let targetCommand: IV2CommandDefinition;

    switch (cmd) {
      case '+1':
        targetCommand = {
          path: !dodge ? endpoints.adjustHeading : endpoints.dodge,
          value: { value: +1 , units: "deg" }
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case '+10':
        targetCommand = {
          path: !dodge ? endpoints.adjustHeading : endpoints.dodge,
          value: { value: +10 , units: "deg" }
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case '-1':
        targetCommand = {
          path: !dodge ? endpoints.adjustHeading : endpoints.dodge,
          value: { value: -1 , units: "deg" }
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case '-10':
        targetCommand = {
          path: !dodge ? endpoints.adjustHeading : endpoints.dodge,
          value: { value: -10 , units: "deg" }
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case 'advanceWaypoint':
        targetCommand = {
          path: `${API_PATHS.V2_COURSE}/activeRoute/nextPoint`
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case 'tack':
        targetCommand = {
          path: `${endpoints.tack}/${(value as { value: string }).value}`
        };
        this.executeRestRequest('POST', targetCommand);
        break;
      case 'gybe':
        targetCommand = {
          path: `${endpoints.gybe}/${value}`
        };
        this.executeRestRequest('POST', targetCommand);
        break;
      case 'dodge':
        targetCommand = {
          path: endpoints.dodge
        };

        if (this.dodgeModeActive()) {
          this.executeRestRequest('DELETE', targetCommand).then(response => {
            if (response.statusCode !== 200) {
              this.dodgeModeActive.set(false);
            }
          });
        } else {
          this.executeRestRequest('POST', targetCommand).then(response => {
            if (response.statusCode !== 200) {
              this.dodgeModeActive.set(true);
            }
          });
        }
        break;
      case 'target_heading':
        targetCommand = {
          path: endpoints.target,
          value: value
        };
        this.executeRestRequest('PUT', targetCommand);
        break;
      case 'standby': {
          const targetCommand: IV2CommandDefinition = {
            path: `${this.apEngaged() ? endpoints.disengage : endpoints.engage}`
          };
          this.executeRestRequest('POST', targetCommand);
        }
        break;
      case 'auto':
      case 'compass':
      case 'gps':
      case 'wind':
      case 'true wind':
      case 'route':
      case 'nav':
        await this.setModeAndEnable(cmd, endpoints);
        break;
      default:
        console.error('Unknown V2 command:', cmd);
        this.displayApError({
          statusCode: 400,
          statusCodeDescription: 'Unknown Command',
          message: `V2 command '${cmd}' is not supported`,
          widgetUUID: this.widgetProperties.uuid
        } as skRequest);
    }
  }

  private async executeRestRequest(method: 'POST' | 'PUT' | 'DELETE', cmd: IV2CommandDefinition): Promise<IV2CommandResponse> {
    try {
      let response: IV2CommandResponse;

      switch(method) {
        case 'POST':
          response = await lastValueFrom(
            this.makeHttpRequest(
              this.http.post<IV2CommandResponse>(cmd.path, undefined)
            )
          );
          break;
        case 'PUT':
          response = await lastValueFrom(
            this.makeHttpRequest(
              this.http.put<IV2CommandResponse>(cmd.path, cmd.value == null ? undefined : cmd.value)
            )
          );
          break;
        case 'DELETE':
          response = await lastValueFrom(
            this.makeHttpRequest(
              this.http.delete<IV2CommandResponse>(cmd.path)
            )
          );
          break;
        default:
          console.error('[Autopilot Widget] Unsupported REST method:', method);
      }

      if (response && response.statusCode === 200) {
        // console.log('[Autopilot Widget] V2 Command executed successfully:', cmd.path);
        return response;
      } else {
        console.warn('[Autopilot Widget] V2 Command completed with non-success status:', JSON.stringify(response));
        return response || { statusCode: 0, message: 'Unavailable', state: 'not provided' };
      }
    } catch (error) {
      console.error('[Autopilot Widget] REST operation failed:', error);

      // Display error to user for V2 command failures
      this.displayApError({
        statusCode: 500,
        statusCodeDescription: 'V2 Command Failed',
        message: `Failed to execute ${method} ${cmd.path}`,
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);

      return {
        statusCode: 0,
        message: error instanceof Error ? error.message : 'REST operation failed',
        state: null
      };
    }
  }

  private async setModeAndEnable(mode: string, endpoints: IV2ApiEndpoints): Promise<void> {
    try {
      const modeResp = await this.executeRestRequest('PUT', { path: endpoints.mode, value: { value: mode } });
      if (modeResp.statusCode !== 200) {
        console.error(`[Autopilot Widget] Failed to set mode '${mode}':`, modeResp);
        return; // abort engage if setting mode failed
      }
      const engageResp = await this.executeRestRequest('PUT', { path: endpoints.state, value: { value: 'enabled' } });
      if (engageResp.statusCode !== 200) {
        console.error(`[Autopilot Widget] Failed to engage after mode '${mode}':`, engageResp);
      }
    } catch (err) {
      console.error('[Autopilot Widget] setModeAndEngage unexpected error:', err);
    }
  }

  private performTackOrGybe(operation: 'tack' | 'gybe', direction: 'port' | 'starboard'): void {
    if (this.widgetProperties.config.autopilot.apiVersion === 'v2') {
      this.sendV2Command(operation, {value: direction});
    } else {
      // Fall back to V1
      if (operation !== 'tack') return;
      // console.log(`[Autopilot Widget] Executing V1 tack to ${direction}`);
      const cmdAction = COMMANDS[direction === 'port' ? 'tackToPort' : 'tackToStarboard'];
      this._requests.putRequest(cmdAction.path, cmdAction.value, this.widgetProperties.uuid);
    }
  }

  // V2 Absolute Target Method (class only - no UI yet)
  protected setAbsoluteTarget(heading: number): void {
    if (this.widgetProperties.config.autopilot.apiVersion === 'v2') {
      this.sendV2Command('target_heading', {"value": heading, "units": "deg"});
    } else {
      console.error('[Autopilot Widget] Absolute target only available in V2 API');
    }
  }

  // V2 Dodge Method (class only - no UI yet)
  protected toggleDodge(): void {
    if (this.widgetProperties.config.autopilot.apiVersion === 'v2') {
      this.sendV2Command('dodge');
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
      // console.log("AP Received: \n" + JSON.stringify(cmdResult));
    }
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
      return;
    }

    const message = `Repeat [Tack ${direction}] key to confirm`;
    this.startConfirmCmd(cmd, message);
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

  private parseMenuItems(menuItems: MenuItem[], mode: string): MenuItem[] {
    // Set enabled/disabled state for each mode menu item based
    const apiVersion = this.widgetProperties.config.autopilot.apiVersion;
    const parsedMenuItems = menuItems.map(item => {
      if (item.isCancel) return { ...item, current: false, disabled: false };

      let enabled = false;
      if (apiVersion === 'v1') {
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
      } else if (apiVersion === 'v2') {
        // For V2, check if the action is in the capabilities
        enabled = this.widgetProperties.config.autopilot.modes.includes(item.action);
      }
      return {
        ...item,
        current: item.action === mode,
        disabled: !enabled
      };
    });
    return parsedMenuItems;
  }

  ngOnDestroy() {
    // Cancel all ongoing HTTP requests
    this.cancelAllHttpRequests();

    // Clear any pending timeouts
    clearTimeout(this.handleCountDownCounterTimeout);
    clearTimeout(this.handleConfirmActionTimeout);
    clearTimeout(this.handleDisplayErrorTimeout);
    clearTimeout(this.handleMessageTimeout);

    // Clean up data streams
    this.destroyDataStreams();
  }
}
