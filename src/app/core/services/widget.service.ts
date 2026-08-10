import { inject, Injectable } from '@angular/core';
import { Type } from '@angular/core';
import { PluginConfigClientService } from './plugin-config-client.service';
import type { IWidgetSvcConfig } from '../interfaces/widgets-interface';
// Widget view components are NOT imported statically. They are loaded on demand through the lazy
// loader map below so each widget's code (and its heavy vendor deps: chart.js, d3, canvas-gauges,
// etc.) ships in its own chunk and is only downloaded when that widget type is actually placed on a
// dashboard. See `_componentTypeMap` and `getComponentType()`.

export const WIDGET_CATEGORIES = ['Core', 'Gauge', 'Component', 'Racing'] as const;
export type TWidgetCategories = typeof WIDGET_CATEGORIES[number];
export enum WidgetCategories {
  Core = "Core",
  Gauge = "Gauge",
  Component = "Component",
  Racing = "Racing"
}
/**
 * WidgetDescription defines the metadata and plugin dependencies for a widget.
 *
 * - requiredPlugins: All listed plugins must be enabled for the widget to function.
 * - anyOfPlugins: If present, at least one listed plugin must be installed and active for the widget to function.
 *
 * Example:
 * {
 *   name: 'Autopilot',
 *   ...
 *   requiredPlugins: [],
 *   anyOfPlugins: ['autopilot', 'pypilot-autopilot-provider']
 * }
 */
export interface WidgetDescription {
  /**
   * The name of the widget, which will be displayed in the widget list.
   * It should be concise and descriptive to help users identify the widget's purpose.
   */
  name: string;
  /**
   * A brief description of the widget's functionality and purpose.
   * This will be displayed in the widget list to help users understand
   * what the widget does.
   */
  description: string;
  /**
   * The icon name in the SVG icon file to be used with MatIconModule.
   */
  icon: string;
  /**
   * Plugins that must be enabled for the widget to function. If empty, no required plugins.
   */
  requiredPlugins: string[];
  /**
    * Plugins where any one must be installed and active for the widget to function.
    * If omitted or empty, no any-of plugin logic is applied.
   */
    anyOfPlugins?: string[];
  /**
   * The category of the widget, used for filtering in the widget list.
   */
  category: TWidgetCategories;
  /**
   * Minimal width constraint of the widget in grid cells.
   */
  minWidth: number;
  /**
   * Minimal height constraint of the widget in grid cells.
   */
  minHeight: number;
  /**
   * The default width of the widget in grid cells upon creation.
   */
  defaultWidth: number;
  /**
   * The default height of the widget in grid cells upon creation.
   */
  defaultHeight: number;
  /**
   * The selector for the widget component, which will be used in the dashboard
   * to instantiate the widget.
   */
  selector: string;
  /**
   * The class name of the component that implements the widget.
   * This is used to dynamically load the component when the widget is added to the dashboard.
   */
  componentClassName: string;
}
export interface WidgetDescriptionWithPluginStatus extends WidgetDescription {
  /**
   * Selection-stage dependency validity.
   *
   * Uses installed/available dependency checks (not runtime enabled state).
   */
  isDependencyValid: boolean;
  /**
   * Selection-stage plugin status list.
   *
   * `enabled` currently represents dependency availability (installed/reachable)
   * for widget selection cards, not plugin active runtime state.
   */
  pluginsStatus: { name: string; enabled: boolean, required: boolean }[];
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private readonly _pluginConfig = inject(PluginConfigClientService);
  private readonly _widgetCategories = [...WIDGET_CATEGORIES];
  // Cache for selector -> component Type resolutions to avoid repeated definition scans
  // Resolved component-type promises, deduped per selector so repeat/concurrent lookups reuse one import().
  private readonly _componentTypePromise = new Map<string, Promise<Type<unknown> | undefined>>();
  // Static DEFAULT_CONFIG captured when a widget loads, so config-only consumers (historical-series
  // reconciliation) can read it synchronously without forcing a chunk download.
  private readonly _defaultConfigCache = new Map<string, IWidgetSvcConfig | undefined>();
  // Lazy loaders: each value dynamically imports its widget component on first use, so the widget's
  // code + vendor deps live in a separate chunk fetched only when that widget type is instantiated.
  private readonly _componentTypeMap: Record<string, () => Promise<Type<unknown>>> = {
    WidgetNumericComponent: () => import('../../widgets/widget-numeric/widget-numeric.component').then(m => m.WidgetNumericComponent),
    WidgetTextComponent: () => import('../../widgets/widget-text/widget-text.component').then(m => m.WidgetTextComponent),
    WidgetWindTrendsChartComponent: () => import('../../widgets/widget-windtrends-chart/widget-windtrends-chart.component').then(m => m.WidgetWindTrendsChartComponent),
    WidgetWindComponent: () => import('../../widgets/widget-windsteer/widget-windsteer.component').then(m => m.WidgetWindComponent),
    WidgetTutorialComponent: () => import('../../widgets/widget-tutorial/widget-tutorial.component').then(m => m.WidgetTutorialComponent),
    WidgetSliderComponent: () => import('../../widgets/widget-slider/widget-slider.component').then(m => m.WidgetSliderComponent),
    WidgetSimpleLinearComponent: () => import('../../widgets/widget-simple-linear/widget-simple-linear.component').then(m => m.WidgetSimpleLinearComponent),
    WidgetRacesteerComponent: () => import('../../widgets/widget-racesteer/widget-racesteer.component').then(m => m.WidgetRacesteerComponent),
    WidgetRacerTimerComponent: () => import('../../widgets/widget-racer-timer/widget-racer-timer.component').then(m => m.WidgetRacerTimerComponent),
    WidgetRacerLineComponent: () => import('../../widgets/widget-racer-line/widget-racer-line.component').then(m => m.WidgetRacerLineComponent),
    WidgetRaceTimerComponent: () => import('../../widgets/widget-race-timer/widget-race-timer.component').then(m => m.WidgetRaceTimerComponent),
    WidgetPositionComponent: () => import('../../widgets/widget-position/widget-position.component').then(m => m.WidgetPositionComponent),
    WidgetAisRadarComponent: () => import('../../widgets/widget-ais-radar/widget-ais-radar.component').then(m => m.WidgetAisRadarComponent),
    WidgetLabelComponent: () => import('../../widgets/widget-label/widget-label.component').then(m => m.WidgetLabelComponent),
    WidgetIframeComponent: () => import('../../widgets/widget-iframe/widget-iframe.component').then(m => m.WidgetIframeComponent),
    WidgetImageComponent: () => import('../../widgets/widget-image/widget-image.component').then(m => m.WidgetImageComponent),
    WidgetHorizonComponent: () => import('../../widgets/widget-horizon/widget-horizon.component').then(m => m.WidgetHorizonComponent),
    WidgetHeelGaugeComponent: () => import('../../widgets/widget-heel-gauge/widget-heel-gauge.component').then(m => m.WidgetHeelGaugeComponent),
    WidgetSteelGaugeComponent: () => import('../../widgets/widget-gauge-steel/widget-gauge-steel.component').then(m => m.WidgetSteelGaugeComponent),
    WidgetGaugeNgRadialComponent: () => import('../../widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component').then(m => m.WidgetGaugeNgRadialComponent),
    WidgetGaugeNgLinearComponent: () => import('../../widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component').then(m => m.WidgetGaugeNgLinearComponent),
    WidgetGaugeNgCompassComponent: () => import('../../widgets/widget-gauge-ng-compass/widget-gauge-ng-compass.component').then(m => m.WidgetGaugeNgCompassComponent),
    WidgetFreeboardskComponent: () => import('../../widgets/widget-freeboardsk/widget-freeboardsk.component').then(m => m.WidgetFreeboardskComponent),
    WidgetHoekensAnchorAlarmComponent: () => import('../../widgets/widget-hoekens-anchor-alarm/widget-hoekens-anchor-alarm.component').then(m => m.WidgetHoekensAnchorAlarmComponent),
    WidgetAnchorAlarmComponent: () => import('../../widgets/widget-anchor-alarm/widget-anchor-alarm.component').then(m => m.WidgetAnchorAlarmComponent),
    WidgetDatetimeComponent: () => import('../../widgets/widget-datetime/widget-datetime.component').then(m => m.WidgetDatetimeComponent),
    WidgetDataChartComponent: () => import('../../widgets/widget-data-chart/widget-data-chart.component').then(m => m.WidgetDataChartComponent),
    WidgetBooleanSwitchComponent: () => import('../../widgets/widget-boolean-switch/widget-boolean-switch.component').then(m => m.WidgetBooleanSwitchComponent),
    WidgetMultiStateSwitchComponent: () => import('../../widgets/widget-multi-state-switch/widget-multi-state-switch.component').then(m => m.WidgetMultiStateSwitchComponent),
    WidgetZonesStatePanelComponent: () => import('../../widgets/widget-zones-state-panel/widget-zones-state-panel.component').then(m => m.WidgetZonesStatePanelComponent),
    WidgetAutopilotComponent: () => import('../../widgets/widget-autopilot/widget-autopilot.component').then(m => m.WidgetAutopilotComponent),
    WidgetBmsComponent: () => import('../../widgets/widget-bms/widget-bms.component').then(m => m.WidgetBmsComponent),
    WidgetSolarChargerComponent: () => import('../../widgets/widget-solar-charger/widget-solar-charger.component').then(m => m.WidgetSolarChargerComponent),
    WidgetChargerComponent: () => import('../../widgets/widget-charger/widget-charger.component').then(m => m.WidgetChargerComponent),
    WidgetInverterComponent: () => import('../../widgets/widget-inverter/widget-inverter.component').then(m => m.WidgetInverterComponent),
    WidgetAlternatorComponent: () => import('../../widgets/widget-alternator/widget-alternator.component').then(m => m.WidgetAlternatorComponent),
    WidgetAcComponent: () => import('../../widgets/widget-ac/widget-ac.component').then(m => m.WidgetAcComponent)
};
  private readonly _widgetDefinition: readonly WidgetDescription[] = [
    {
      name: 'Numeric',
      description: 'Displays numeric data in a clear and concise format, with options to show minimum and/or maximum recorded values. Includes an optional background minichart for quick visual trend insights.',
      icon: 'numericWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays text data with a customizable color formatting option.',
      icon: 'textWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays date and time data with fully custom formatting options and timezone correction.',
      icon: 'datetimeWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Position',
      description: 'Displays latitude and longitude for location tracking and navigation.',
      icon: 'positionWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-position',
      componentClassName: 'WidgetPositionComponent',
    },
    {
      name: 'Static Label',
      description: 'A static text widget that allows you to add customizable labels to your dashboard, helping to organize and clarify your layout effectively.',
      icon: 'labelWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-label',
      componentClassName: 'WidgetLabelComponent'
    },
    {
      name: 'Switch Panel',
      description: 'A Digital Switching panel group with multiple controls including toggle switches, indicator lights, and press buttons to send Signal K paths values and other operations.',
      icon: 'switchpanelWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Multi-State Switch',
      description: 'Lists all available device/path operating modes/states (e.g., On, Off, Charge Only, Invert Only), highlights the current state, and lets you select a new state to send to the device and see the result.',
      icon: 'multiStateSwitchWidget',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 4,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-multi-state-switch',
      componentClassName: 'WidgetMultiStateSwitchComponent'
    },
    {
      name: 'Zones State Panel',
      description: "Displays the data state (severity and message) of the path's Zones (based on Signal K path metadata configuration).",
      icon: 'zonesStatePanel',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-zones-state-panel',
      componentClassName: 'WidgetZonesStatePanelComponent'
    },
    {
      name: 'Slider',
      description: 'A Digital Switching range slider that allows users to adjust values, such as controlling lighting intensity or audio volume from 0% to 100%.',
      icon: 'sliderWidget',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 4,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-slider',
      componentClassName: 'WidgetSliderComponent'
    },
    {
      name: "Compact Linear",
      description: "A simple horizontal linear gauge with a large value label offering a clean, compact modern look.",
      icon: 'simpleLinearGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge that supports zone highlighting.',
      icon: 'linearGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A radial gauge with configurable capacity and measurement dials plus zone highlighting.',
      icon: 'radialGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card-style rotating compass gauge with multiple cardinal point indicator options.',
      icon: 'compassGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Level Gauge',
      description: 'Dual-scale heel angle indicator combining a high‑precision ±5° fine level with a wide ±40° coarse arc for fast trim tuning and broader heel / sea‑state monitoring.',
      icon: 'level',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-heel-gauge',
      componentClassName: 'WidgetHeelGaugeComponent'
    },
    {
      name: 'Pitch & Roll',
      description: 'Horizon-style attitude indicator showing live pitch and roll degrees with smooth animation—ideal for monitoring trim, heel, and sea-state response.',
      icon: 'pitchRollGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-horizon',
      componentClassName: 'WidgetHorizonComponent'
    },
    {
      name: 'Classic Steel',
      description: 'A traditional steel looking linear & radial gauges replica that supports range sizes and zones highlights.',
      icon: 'steelGauge',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-steel',
      componentClassName: 'WidgetSteelGaugeComponent'
    },
    {
      name: 'Battery Monitor',
      description: 'Displays battery banks and individual batteries with aggregated bank totals plus per-battery detail cards. See key BMS values such as state of charge, current, voltage, power, temperature, capacity, and time remaining for a clearer view of overall bank health and individual battery status.',
      icon: 'battery_charging',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-bms',
      componentClassName: 'WidgetBmsComponent'
    },
    {
      name: 'Solar Charger',
      description: 'Track solar generation and charging performance at a glance with live panel output, battery-side metrics, and clear charger and relay status indicators.',
      icon: 'solar_charger',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-solar-charger',
      componentClassName: 'WidgetSolarChargerComponent'
    },
    {
      name: 'AC/DC Charger',
      description: 'Track charger output and charging state with voltage, current, power, and temperature monitoring, including real-time charging stage indicators.',
      icon: 'charger',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-charger',
      componentClassName: 'WidgetChargerComponent'
    },
/*     {
      name: 'Alternator',
      description: 'Monitor alternator output and charging performance with voltage, current, power, revolutions and temperature metrics.',
      icon: 'alternator',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-alternator',
      componentClassName: 'WidgetAlternatorComponent'
    },
    {
      name: 'Inverter',
      description: 'Monitor inverter input and output with AC voltage, current, power, and temperature metrics. Track real-time inverter state and mode. Manage multiple linked inverter units with grouped device configuration.',
      icon: 'inverter',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-inverter',
      componentClassName: 'WidgetInverterComponent'
    },
    {
      name: 'AC Monitor',
      description: 'Monitor AC bus and line-level loads with real-time voltage, current, frequency, and power metrics.',
      icon: 'acMonitor',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-ac',
      componentClassName: 'WidgetAcComponent'
    }, */
    {
      name: 'Windsteer',
      description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information.',
      icon: 'windsteeringWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-wind-steer',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'Freeboard-SK',
      description: 'Adds the Freeboard-SK chart plotter as a widget with automatic sign-in to your dashboard.',
      icon: 'freeboardWidget',
      minWidth: 6,
      minHeight: 8,
      defaultWidth: 6,
      defaultHeight: 14,
      category: 'Component',
      requiredPlugins: ['freeboard-sk', 'tracks', 'resources-provider', 'course-provider'],
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'Provides typical autopilot controls for Signal K v1 & v2 Autopilot API devices. Requires a compatible hardware-specific Autopilot plugin for full functionality.',
      icon: 'autopilotWidget',
      minWidth: 3,
      minHeight: 9,
      defaultWidth: 4,
      defaultHeight: 10,
      category: 'Component',
      requiredPlugins: [],
      anyOfPlugins: ['autopilot', 'pypilot-autopilot-provider'],
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Realtime Data Chart',
      description: 'Visualizes data on a real-time chart with multiple preconfigured series including actuals, SMA and period overall averages and Min/Max. Requires the KIP Dataset to be configured.',
      icon: 'datachartWidget',
      minWidth: 2,
      minHeight: 3,
      defaultWidth: 6,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: "Hoeken's Anchor Alarm",
      description: "Map-first anchor alarm experience for Signal K with advanced watch-zone tools (circle, sector, polygon), interactive setup, tracks/fleet overlays, scope calculator, and optional engine-start auto-silence for practical onboard use.",
      icon: 'anchorWatch',
      minWidth: 6,
      minHeight: 8,
      defaultWidth: 6,
      defaultHeight: 14,
      category: 'Component',
      requiredPlugins: ['hoekens-anchor-alarm'],
      selector: 'widget-hoekens-anchor-alarm',
      componentClassName: 'WidgetHoekensAnchorAlarmComponent'
    },
    {
      name: "Anchor Watch",
      description: "Classic anchor monitoring focused on reliable server-side drift detection: configurable alarm radius, automatic radius calculation from rode/depth, intelligent anchor-position detection, position history, multiple warning/alarm types, GPS bow-offset compensation, plus REST API and Signal K PUT integration.",
      icon: 'anchorWatch',
      minWidth: 6,
      minHeight: 8,
      defaultWidth: 6,
      defaultHeight: 14,
      category: 'Component',
      requiredPlugins: ['anchoralarm'],
      selector: 'widget-anchor-alarm',
      componentClassName: 'WidgetAnchorAlarmComponent'
    },
    {
      name: 'AIS Radar',
      description: 'Displays AIS targets with range rings, interactive target details, and quick zoom and filtering controls.',
      icon: 'aisradar',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 5,
      defaultHeight: 8,
      category: 'Component',
      requiredPlugins: [],
      //anyOfPlugins: ['signalk-ais-target-prioritizer'],
      selector: 'widget-ais-radar',
      componentClassName: 'WidgetAisRadarComponent'
    },
    {
      name: 'Embed Webpage Viewer',
      description: 'Embeds external web-based applications—such as Grafana graphs or other Signal K apps—into your dashboard for seamless integration. Interaction is disabled by default but can be enabled.',
      icon: 'embedWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'Image',
      description: 'Displays an uploaded image (e.g. a diagram of where safety equipment is stowed) stored on the Signal K server, scaled to fit while preserving aspect ratio. Upload images or pick from the shared library in the widget options.',
      icon: 'imageWidget',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: ['sk-image'],
      selector: 'widget-image',
      componentClassName: 'WidgetImageComponent',
    },
    {
      name: 'Tutorial',
      description: 'An instructional widget that guides new users through basic navigation, gestures, and dashboard editing steps.',
      icon: 'helpWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-tutorial',
      componentClassName: 'WidgetTutorialComponent'
    },
    {
      name: 'Racesteer (BETA)',
      description: 'A dynamic race steering display that fuses polar performance data with live conditions to guide optimal steering, tacking, and gybing angles for maximum speed. Instantly compare performance against competition polars for smarter tactical decisions.',
      icon: 'racesteeringWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Racing',
      requiredPlugins: ['signalk-polar-performance-plugin'],
      selector: 'widget-racesteer',
      componentClassName: 'WidgetRacesteerComponent'
    },
    {
      name: 'Racer - Start Line Insight',
      description: 'Gain a tactical advantage for racing starts: set and adjust the port and starboard ends of the start line, see your distance to the line, the favored end, and how much the line is favored or unfavored. Includes visual integration with Freeboard SK for interactive line adjustment and display.',
      icon: 'racerlineWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 4,
      requiredPlugins: ['signalk-racer'],
      category: 'Racing',
      selector: 'widget-racer-line',
      componentClassName: 'WidgetRacerLineComponent',
    },
    {
      name: 'Racer - Start Timer',
      description: 'An advanced racing countdown timer that indicates OCS (On Course Side) status. Set the start line, choose or adjust the duration, or specify the exact start time. Automatically switches to the target dashboard at the start unless over early.',
      icon: 'racertimerWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 4,
      requiredPlugins: ['signalk-racer'],
      category: 'Racing',
      selector: 'widget-racer-timer',
      componentClassName: 'WidgetRacerTimerComponent',
    },
    {
      name: 'Countdown Timer',
      description: 'A simple race start countdown timer that can be started, paused, synced, reset, and configured for duration.',
      icon: 'racetimerWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 6,
      defaultHeight: 7,
      category: 'Racing',
      requiredPlugins: [],
      selector: 'widget-racetimer',
      componentClassName: 'WidgetRaceTimerComponent'
    },
    {
      name: 'Wind Trends',
      description: 'A real-time wind trends graph with dual axes for direction and speed. Displays live values and simple moving averages over the current period’s average.',
      icon: 'windtrendsWidget',
      minWidth: 8,
      minHeight: 6,
      defaultWidth: 10,
      defaultHeight: 8,
      category: 'Racing',
      requiredPlugins: [],
      selector: 'widget-windtrends-chart',
      componentClassName: 'WidgetWindTrendsChartComponent'
    },
  ];

  get kipWidgets(): readonly WidgetDescription[] {
    return this._widgetDefinition;
  }

  get categories(): string[] {
    return this._widgetCategories;
  }

  /**
   * Resolves a widget's runtime component Type from its selector by dynamically importing the
   * widget's chunk on demand.
   *
   * Flow:
   *  1. Locate the widget definition whose `selector` matches the provided string.
   *  2. Look up the definition's lazy loader inside `_componentTypeMap` and `import()` it.
   *  3. Resolve with the component Type (and cache its DEFAULT_CONFIG), or `undefined` if unknown.
   *
   * The returned promise is cached per selector so repeat/concurrent lookups reuse a single import.
   * Host2 (and widget-embedded) await this before creating the child; they fall back to a safe
   * default when it resolves `undefined`.
   *
   * @param selector Dashboard widget type / selector (e.g. `widget-numeric`).
   * @returns Promise resolving to the Angular component Type, or undefined if unknown / failed to load.
   */
  public getComponentType(selector: string): Promise<Type<unknown> | undefined> {
    const existing = this._componentTypePromise.get(selector);
    if (existing) return existing;

    const def = this._widgetDefinition.find(w => w.selector === selector);
    if (!def) return Promise.resolve(undefined);

    const loader = this._componentTypeMap[def.componentClassName];
    if (!loader) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        console.warn('[WidgetService] No component mapping for', def.componentClassName);
      }
      return Promise.resolve(undefined);
    }

    const promise = loader()
      .then(componentType => {
        // Capture the static DEFAULT_CONFIG so config-only consumers can read it without re-loading.
        this._defaultConfigCache.set(
          selector,
          (componentType as { DEFAULT_CONFIG?: IWidgetSvcConfig }).DEFAULT_CONFIG
        );
        return componentType;
      })
      .catch((error: unknown) => {
        // Drop the cached promise so a later attempt can retry the import after a transient failure.
        this._componentTypePromise.delete(selector);
        console.error('[WidgetService] Failed to load component for', def.componentClassName, error);
        return undefined;
      });

    this._componentTypePromise.set(selector, promise);
    return promise;
  }

  /**
   * Synchronously returns a widget type's static DEFAULT_CONFIG IF its component has already been
   * loaded (e.g. it is rendered on a dashboard). Returns `undefined` for widgets whose chunk has not
   * been fetched yet — config-only callers should treat that as "not yet known" and fall back to the
   * saved config rather than force a chunk download.
   *
   * @param selector Dashboard widget type / selector (e.g. `widget-numeric`).
   * @returns The cached DEFAULT_CONFIG, or undefined if the component has not been loaded.
   */
  public getDefaultConfig(selector: string): IWidgetSvcConfig | undefined {
    return this._defaultConfigCache.get(selector);
  }

  /**
   * Returns the list of widget definitions, each enriched with plugin dependency status.
   *
   * For each widget, this method:
    * - Checks all unique plugin dependencies for installation/availability using the PluginConfigClientService (each dependency is checked only once, even if used by multiple widgets).
   * - Adds the following properties to each widget:
    * - `isDependencyValid`: `true` if all required plugins are installed and, if anyOfPlugins is present, at least one any-of plugin is installed. Otherwise `false`.
    * - `pluginsStatus`: an array of objects, each with `{ name: string, enabled: boolean, required: boolean }` for every dependency (required and optional).
    *   Note: in this selection-stage payload, `enabled` indicates dependency availability (installed/reachable), not active runtime plugin state.
   *
   * @returns Promise resolving to an array of WidgetDescriptionWithPluginStatus objects.
   *
   * Example usage:
   * ```typescript
   * const widgets = await widgetService.getKipWidgetsWithStatus();
   * widgets.forEach(widget => {
   *   console.log(widget.name, widget.isDependencyValid, widget.pluginsStatus);
   * });
   * ```
   */
  public async getKipWidgetsWithStatus(): Promise<WidgetDescriptionWithPluginStatus[]> {
    const pluginCache: Record<string, boolean> = {};

    // Collect all unique plugin dependencies (required + optional)
    const allDeps = Array.from(
      new Set(this._widgetDefinition.flatMap(w => [
        ...(w.requiredPlugins || []),
        ...(w.anyOfPlugins || [])
      ]))
    );

    // Check each unique dependency once (installed status for selection-stage validation)
    await Promise.all(
      allDeps.map(async dep => {
        const result = await this._pluginConfig.getPlugin(dep);
        pluginCache[dep] = result.ok;
      })
    );

    // Map widgets using the cached results
    return this._widgetDefinition.map(widget => {
      const required = widget.requiredPlugins || [];
      const anyOf = widget.anyOfPlugins || [];

      const requiredStatus = required.map(dep => ({
        name: dep,
        enabled: pluginCache[dep],
        required: true
      }));
      const anyOfStatus = anyOf.map(dep => ({
        name: dep,
        enabled: pluginCache[dep],
        required: false
      }));
      const pluginsStatus = [...requiredStatus, ...anyOfStatus];
      // Widget is valid if all required plugins are installed AND (if any any-of plugins, at least one is installed)
      let isDependencyValid = requiredStatus.every(p => p.enabled);
      if (isDependencyValid && anyOf.length > 0) {
        isDependencyValid = anyOfStatus.some(p => p.enabled);
      }
      return {
        ...widget,
        isDependencyValid,
        pluginsStatus
      };
    });
  }
}
