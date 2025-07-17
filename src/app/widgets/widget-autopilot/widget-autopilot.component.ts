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

import { Component, OnInit, OnDestroy, viewChild, inject, signal, effect, untracked, DestroyRef, computed } from '@angular/core';
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
import { firstValueFrom, lastValueFrom, Observable, finalize } from 'rxjs';
import { SignalkPluginsService } from '../../core/services/signalk-plugins.service';
import { AppService } from '../../core/services/app-service';
import {
  IV2ApiEndpoints,
  IV2CommandDefinition,
  IV2CommandResponse,
  IV2AutopilotProvider,
  IV2AutopilotOptionsResponse,
  IV1CommandDefinition,
  V1CommandsMap
} from '../../core/interfaces/signalk-autopilot-interfaces';

// Shared constants for API paths and configuration
const API_PATHS = {
  V1_PLUGIN: 'autopilot',
  V2_BASE: '/signalk/v2/api',
  V2_VESSELS_SELF: '/signalk/v2/api/vessels/self',
  V2_AUTOPILOTS: '/signalk/v2/api/vessels/self/autopilots',
  V2_COURSE: '/signalk/v2/api/vessels/self/navigation/course'
} as const;

const V2_ENDPOINT_TEMPLATES: Record<string, (instance: string) => string> = {
  BASE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}`,
  ENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/engage`,
  DISENGAGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/disengage`,
  MODE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/mode`,
  TARGET_HEADING: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/target`,
  TACK: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/tack`,
  GYBE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/gybe`,
  DODGE: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/dodge`,
  ADJUST_HEADING: (instance: string) => `${API_PATHS.V2_AUTOPILOTS}/${instance}/target/adjust`,
};

const FAILSAFE_OPTIONS_RESPONSE: IV2AutopilotOptionsResponse = {
  options: {
    modes: [],
    states: []
  },
  state: null,
  mode: 'off-line',
  target: null,
  engaged: false
};

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
} as const;

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
  protected availableAutopilots = signal<IV2AutopilotProvider>({});
  protected discoveryInProgress = signal<boolean>(false);
  protected apiDetectionError = signal<string | null>(null);

  // Request management
  private currentRequests = new Set<Observable<unknown>>();

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
  protected readonly dodgeBtn = viewChild<MatButton>('dodgeBtn');

  protected apStatePath = signal<string | null>(null); // Current Pilot Mode - used for display, keyboard state and buildCommand function
  protected apState = computed<string | null>(() => {
    const state = this.apStatePath();
    if (state === 'auto' || state === 'compass') return 'auto';
    if (state === 'wind') return 'wind';
    if (state === 'route' || state === 'gps') return 'route';
    if (state === 'standby') return 'standby';
    if (state === 'off-line') return 'off-line';
    return this.apStatePath();
  });
  protected dodgeModeActive = signal<boolean>(false);
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
            console.log(`[Autopilot Widget] API ${version} | Default AP Capabilities: [${capabilities.join(', ')}]`);
          } else {
            console.log(`[Autopilot Widget] API ${version} active with Raymarine plugin capabilities`);
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
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = true;
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
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = true;
            break;
          case "auto":
            this.modesBtn().disabled = false;
            this.engageBtn().disabled = false;
            this.plus1Btn().disabled = false;
            this.plus10Btn().disabled = false;
            this.minus1Btn().disabled = false;
            this.minus10Btn().disabled = false;
            this.prtTackBtn().disabled = false;
            this.stbTackBtn().disabled = false;
            this.advWptBtn().disabled = true;
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = true;
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
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = true;
            break;
          case "route":
            this.modesBtn().disabled = false;
            this.engageBtn().disabled = false;
            if (this.dodgeModeActive()) {
              this.plus1Btn().disabled = false;
              this.plus10Btn().disabled = false;
              this.minus1Btn().disabled = false;
              this.minus10Btn().disabled = false;
            } else {
              this.plus1Btn().disabled = true;
              this.plus10Btn().disabled = true;
              this.minus1Btn().disabled = true;
              this.minus10Btn().disabled = true;
            }
            this.prtTackBtn().disabled = true;
            this.stbTackBtn().disabled = true;
            if (this.dodgeModeActive()) {
              this.advWptBtn().disabled = true;
            } else {
              this.advWptBtn().disabled = false;
            }
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = false;
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
            if (this.dodgeBtn()) this.dodgeBtn()!.disabled = true;
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

  protected startWidget(): void {
    this.startAllSubscriptions();
  }

  /**
   * Detects available autopilot API version and configures endpoints
   *
   * Detection Logic:
   * 1. First attempts V2 API detection via /signalk/v2/api/vessels/self/autopilots
   * 2. If V2 available, discovers autopilot instances and capabilities
   * 3. Falls back to V1 plugin detection (signalk-autopilot)
   * 4. Sets persistent error state if no API found
   *
   * State Management:
   * - Sets discoveryInProgress during detection
   * - Updates apiVersion signal with detected version
   * - Configures v2Endpoints for discovered instances
   * - Handles error overlays for offline state
   *
   * @returns Promise<void> Resolves when detection complete
   * @throws Never throws - all errors handled internally
   */
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
        const autopilots = this.availableAutopilots();
        const instanceCount = autopilots ? Object.keys(autopilots).length : 0;
        if (instanceCount > 0) {
          await this.discoverV2AutopilotOptions();
          console.log('[Autopilot Widget] V2 API detected with autopilots:', this.availableAutopilots());
          this.discoveryInProgress.set(false);

          // Clear any persistent error overlay from previous offline state
          this.errorOverlayVisibility.set('hidden');
          this.errorOverlayText.set('');
          this.isPersistentError = false;
          return;
        }
       console.log('[Autopilot Widget] No V2 Autopilot present, checking V1...');
      }
    } catch (error) {
      console.error('[Autopilot Widget] Error checking V2 API, checking V1...', error);
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
    this.apStatePath.set('off-line');
    this.apiDetectionError.set('[Autopilot Widget] No autopilot API available');

    this.errorOverlayText.set('No Autopilot detected');
    this.errorOverlayVisibility.set('visible');
    this.isPersistentError = true;
    this.discoveryInProgress.set(false);
  }

  private async checkV2Api(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.makeHttpRequest(
          this.http.get(API_PATHS.V2_AUTOPILOTS, {
            observe: 'response',
            responseType: 'json'
          })
        )
      );
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
      const response = await firstValueFrom(
        this.makeHttpRequest(
          this.http.get<IV2AutopilotProvider>(API_PATHS.V2_AUTOPILOTS)
        )
      );
      this.availableAutopilots.set(response);
      console.log('[Autopilot Widget] Discovered V2 autopilot instances:', response);
      const configuredInstance = this.widgetProperties.config.autopilotInstance || DEFAULTS.AUTOPILOT_INSTANCE;
      console.log(`[Autopilot Widget] Configured autopilot instance: '${configuredInstance}'`);
    } catch (error) {
      console.error('[Autopilot Widget] Failed to discover V2 autopilots:', error);
      this.availableAutopilots.set({});
      this.apiDetectionError.set(`Failed to discover autopilots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async discoverV2AutopilotOptions(): Promise<void> {
    const targetInstance = this.widgetProperties.config.autopilotInstance;
    let response: IV2AutopilotOptionsResponse;

    try {
      // TODO: Support multiple AP instances
      // Get AP supported modes and states from the specific instance
      try {
        response = await firstValueFrom(
          this.makeHttpRequest(
            this.http.get<IV2AutopilotOptionsResponse>(
              V2_ENDPOINT_TEMPLATES.BASE(targetInstance)
            )
          )
        );
      } catch {
        response = FAILSAFE_OPTIONS_RESPONSE;
        console.log(`[Autopilot Widget] Default AP discovery endpoint error for instance '${targetInstance}'`);
      }

      // Build endpoint URLs using the target instance
      const endpoints: IV2ApiEndpoints = {
        engage: V2_ENDPOINT_TEMPLATES.ENGAGE(targetInstance),
        disengage: V2_ENDPOINT_TEMPLATES.DISENGAGE(targetInstance),
        mode: V2_ENDPOINT_TEMPLATES.MODE(targetInstance),
        target: V2_ENDPOINT_TEMPLATES.TARGET_HEADING(targetInstance),
        tack: V2_ENDPOINT_TEMPLATES.TACK(targetInstance),
        gybe: V2_ENDPOINT_TEMPLATES.GYBE(targetInstance),
        dodge: V2_ENDPOINT_TEMPLATES.DODGE(targetInstance),
        adjustHeading: V2_ENDPOINT_TEMPLATES.ADJUST_HEADING(targetInstance)
      };

      this.v2Endpoints.set(endpoints);
      this.autopilotCapabilities.set(response.options.modes || []);

      console.log(`[Autopilot Widget] V2 endpoints configured for instance '${targetInstance}':`, endpoints);
    } catch (error) {
      console.error('[Autopilot Widget] Failed to discover V2 endpoints:', error);
      const fallbackEndpoints: IV2ApiEndpoints = {
        engage: V2_ENDPOINT_TEMPLATES.ENGAGE(targetInstance),
        disengage: V2_ENDPOINT_TEMPLATES.DISENGAGE(targetInstance),
        mode: V2_ENDPOINT_TEMPLATES.MODE(targetInstance),
        target: V2_ENDPOINT_TEMPLATES.TARGET_HEADING(targetInstance),
        tack: V2_ENDPOINT_TEMPLATES.TACK(targetInstance),
        gybe: V2_ENDPOINT_TEMPLATES.GYBE(targetInstance),
        dodge: V2_ENDPOINT_TEMPLATES.DODGE(targetInstance),
        adjustHeading: V2_ENDPOINT_TEMPLATES.ADJUST_HEADING(targetInstance)
      };
      this.v2Endpoints.set(fallbackEndpoints);
      this.autopilotCapabilities.set(FAILSAFE_OPTIONS_RESPONSE.options.modes);
      console.log(`[Autopilot Widget] Using fallback V2 endpoints for instance '${targetInstance}'`);
    }
  }

  protected isV2CommandSupported(command: string): boolean {
    return this.autopilotCapabilities().includes(command);
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    const previousInstance = this.widgetProperties.config.autopilotInstance;
    this.widgetProperties.config = config;

    // Cancel any ongoing HTTP requests
    this.cancelAllHttpRequests();

    // If autopilot instance changed and we're using V2 API, re-discover endpoints
    const newInstance = config.autopilotInstance;
    if (this.apiVersion() === 'v2' && previousInstance !== newInstance) {
      console.log(`[Autopilot Widget] Autopilot instance changed from '${previousInstance}' to '${newInstance}', re-discovering endpoints`);
      this.discoveryInProgress.set(true);
      this.apiDetectionError.set(null);

      this.discoverV2AutopilotOptions().then(() => {
        console.log('[Autopilot Widget] Endpoint discovery completed successfully, starting subscriptions');
        this.startAllSubscriptions();
      }).catch(error => {
        console.error('[Autopilot Widget] Failed to re-discover V2 endpoints after config change:', error);
        this.apiDetectionError.set(`Failed to re-discover endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.warn('[Autopilot Widget] Blocking subscription restart due to discovery failure');
        // Don't call startAllSubscriptions() on failure - block to prevent using stale data
      }).finally(() => {
        this.discoveryInProgress.set(false);
      });

      // For V2 with instance change, only start subscriptions after successful discovery
      return;
    }

    // For V1 or no instance change, start subscriptions immediately
    this.startAllSubscriptions();
  }

  private startAllSubscriptions(): void {
    this.unsubscribeDataStream();

    // Only subscribe to autopilot state if we have a valid API
    if (this.apiVersion()) {
      this.observeDataStream('autopilotState', newValue => {
        if (newValue.data?.value) {
          this.apStatePath.set(newValue.data.value);
          console.warn(`[Autopilot Widget] Autopilot state updated: ${newValue.data.value}`);
        } else {
          this.apStatePath.set('off-line');
          console.warn('[Autopilot Widget] Autopilot state is null or not available');
        }
      });
      this.observeDataStream('autopilotTargetHeading', newValue => this.autopilotTargetHeading = newValue.data.value != null ? newValue.data.value : 0);
      this.observeDataStream('autopilotTargetWindHeading', newValue => this.autopilotTargetWindHeading = newValue.data.value != null ? newValue.data.value : 0);
      this.observeDataStream('courseXte', newValue => this.crossTrackError = newValue.data.value != null ? newValue.data.value : 0);
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
        this.observeDataStream('headingTrue', newValue => this.heading = newValue.data.value != null ? newValue.data.value : 0);
      } else {
        this.observeDataStream('headingMag', newValue => this.heading = newValue.data.value != null ? newValue.data.value : 0);
      }
      this.observeDataStream('windAngleApparent', newValue => this.windAngleApparent = newValue.data.value != null ? newValue.data.value : 0);
    }
    if (this.apiVersion() === 'v1') {
      // Subscribe to V1 autopilot PUT state changes
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
    const cmdAction = commands[cmd];
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
    if ((cmd === 'route') && (this.apState() === 'route') && (this.actionToBeConfirmed === '')) {
      this.confirmAdvanceWaypoint(cmd);
      return;
    }
    if (this.actionToBeConfirmed === cmd) {
      this.clearConfirmCmd();
      if ((cmd === 'tackToPort') || (cmd === 'tackToStarboard')) {
        const direction = cmd === 'tackToPort' ? 'port' : 'starboard';
        this.performTackOrGybe('tack', direction);
      }
      if ((cmd === 'route') && (this.apState() === 'route')) {
        this.commandVersion(cmd, commands['advanceWaypoint']);
      }
      return;
    }
    this.commandVersion(cmd, cmdAction);
  }

  private commandVersion(cmd: string, cmdAction: IV1CommandDefinition): void {
    if (this.apiVersion() === 'v2') {
      this.sendV2Command(cmd, cmdAction);
    } else if (this.apiVersion() === 'v1' && !cmdAction.path.startsWith('v2:')) {
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
    this.signalkRequestsService.putRequest(cmdAction["path"], cmdAction["value"], this.widgetProperties.uuid);
    console.log("AP Action:\n" + JSON.stringify(cmdAction));
  }

  /**
   * Executes V2 autopilot commands using REST endpoints
   *
   * Command Mapping:
   * ┌─────────────────┬─────────┬──────────────────────────────────────┐
   * │ Command         │ Method  │ Endpoint Pattern                     │
   * ├─────────────────┼─────────┼──────────────────────────────────────┤
   * │ +1, +10, -1, -10│ PUT     │ /autopilots/{instance}/target/adjust │
   * │ auto/wind/route │ PUT     │ /autopilots/{instance}/mode          │
   * │ standby         │ PUT     │ /autopilots/{instance}/mode          │
   * │ target_heading  │ PUT     │ /autopilots/{instance}/target        │
   * │ advanceWaypoint │ PUT     │ /navigation/course/activeRoute/...   │
   * │ tack            │ POST    │ /autopilots/{instance}/tack/{dir}    │
   * │ gybe            │ POST    │ /autopilots/{instance}/gybe/{dir}    │
   * │ dodge           │ POST/DEL│ /autopilots/{instance}/dodge         │
   * └─────────────────┴─────────┴──────────────────────────────────────┘
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
  private async sendV2Command(cmd: string, cmdAction?: IV1CommandDefinition, value?: object): Promise<void> {
    const endpoints = this.v2Endpoints();
    if (!endpoints) {
      console.error('V2 endpoints not available');
      return;
    }

    const dodge = this.dodgeModeActive();
    let targetCommand: IV2CommandDefinition;

    switch (cmd) {
      case '+1':
        targetCommand = {
          path: dodge ? this.v2Endpoints().adjustHeading : this.v2Endpoints().dodge,
          value: { value: +1 , units: "deg" }
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case '+10':
        targetCommand = {
          path: dodge ? this.v2Endpoints().adjustHeading : this.v2Endpoints().dodge,
          value: { value: +10 , units: "deg" }
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case '-1':
        targetCommand = {
          path: dodge ? this.v2Endpoints().adjustHeading : this.v2Endpoints().dodge,
          value: { value: -1 , units: "deg" }
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case '-10':
        targetCommand = {
          path: dodge ? this.v2Endpoints().adjustHeading : this.v2Endpoints().dodge,
          value: { value: -10 , units: "deg" }
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'target_heading':
        targetCommand = {
          path: this.v2Endpoints().target,
          value: value
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'auto':
        targetCommand = {
          path: this.v2Endpoints().mode,
          value: {value: "auto"}
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'wind':
        targetCommand = {
          path: this.v2Endpoints().mode,
          value: {value: "wind"}
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'route':
        targetCommand = {
          path: this.v2Endpoints().mode,
          value: {value: "route"}
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'standby':
        targetCommand = {
          path: this.v2Endpoints().mode,
          value: {value: "standby"}
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'advanceWaypoint':
        targetCommand = {
          path: `${API_PATHS.V2_COURSE}/activeRoute/nextPoint`
        };
        this.sendRestCommand('PUT', targetCommand);
        break;
      case 'tack':
        targetCommand = {
          path: `${this.v2Endpoints().tack}/${value}`
        };
        this.sendRestCommand('POST', targetCommand);
        break;
      case 'gybe':
        targetCommand = {
          path: `${this.v2Endpoints().gybe}/${value}`
        };
        this.sendRestCommand('POST', targetCommand);
        break;
      case 'dodge':
        targetCommand = {
          path: this.v2Endpoints().dodge
        };

        if (this.dodgeModeActive()) {
          this.sendRestCommand('DELETE', targetCommand).then(response => {
            if (response.status === 'success') {
              this.dodgeModeActive.set(false);
            }
          });
        } else {
          this.sendRestCommand('POST', targetCommand).then(response => {
            if (response.status === 'success') {
              this.dodgeModeActive.set(true);
            }
          });
        }
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

  private async sendRestCommand(method: 'POST' | 'PUT' | 'DELETE', cmd: IV2CommandDefinition): Promise<IV2CommandResponse> {
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

      if (response && response.status === 'success') {
        console.log('[Autopilot Widget] Command executed successfully:', cmd.path);
        return response;
      } else {
        console.warn('[Autopilot Widget] Command completed with non-success status:', response);
        return response || { status: 'error', message: 'Invalid response format', data: null };
      }
    } catch (error) {
      console.error('[Autopilot Widget] REST operation failed:', error);

      // Display error to user for V2 command failures
      this.displayApError({
        statusCode: 500,
        statusCodeDescription: 'V2 Command Failed',
        message: `Failed to execute ${method} ${cmd.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        widgetUUID: this.widgetProperties.uuid
      } as skRequest);

      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'REST operation failed',
        data: null
      };
    }
  }

  private performTackOrGybe(operation: 'tack' | 'gybe', direction: 'port' | 'starboard'): void {
    if (this.apiVersion() === 'v2') {
      this.sendV2Command(operation, null, {value: direction});
    } else {
      // Fall back to V1
      if (operation !== 'tack') return;
      console.log(`[Autopilot Widget] Executing V1 tack to ${direction}`);
      const cmdAction = commands[direction === 'port' ? 'tackToPort' : 'tackToStarboard'];
      this.signalkRequestsService.putRequest(cmdAction.path, cmdAction.value, this.widgetProperties.uuid);
    }
  }

  // V2 Absolute Target Method (class only - no UI yet)
  protected setAbsoluteTarget(heading: number): void {
    if (this.apiVersion() === 'v2') {
      this.sendV2Command('target_heading', null, {"value": heading, "units": "deg"});
    } else {
      console.error('[Autopilot Widget] Absolute target only available in V2 API');
    }
  }

  // V2 Dodge Method (class only - no UI yet)
  protected toggleDodge(): void {
    if (this.apiVersion() === 'v2') {
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
      console.log("AP Received: \n" + JSON.stringify(cmdResult));
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

  ngOnDestroy() {
    // Cancel all ongoing HTTP requests
    this.cancelAllHttpRequests();

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
