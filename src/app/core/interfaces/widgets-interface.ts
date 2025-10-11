import { ITheme } from '../services/app-service';
import { TValidSkUnits } from '../services/units.service';
import { TFormat, TPolicy, TScaleType } from './signalk-interfaces';


export enum ControlType {
  toggle = 0,
  push = 1,
  indicator = 2,
}

/**
 * Allowed path types for Signal K data paths.
 * - 'number'
 * - 'string'
 * - 'boolean'
 * - 'Date'
 * - null
 */
export type TWidgetPathType = 'number' | 'string' | 'boolean' | 'Date' | null;

/**
 * KIP Dynamic Widgets interface.
 *
 * @export
 * @interface DynamicWidget
 */
export interface DynamicWidget {
  widgetProperties: IWidget;
  theme: ITheme;
  defaultConfig: IWidgetSvcConfig;
  unlockStatus?: boolean; // only used by Tutorial
}

/**
 * This interface defines possible Widget properties.
 *
 * @export
 * @interface IWidget
 */
export interface IWidget {
  /** The Widget's unique identifier */
  uuid: string;
   /** The Widget's type. Value are defined in widget-list.service */
  type: string;
   /** The Widget's configuration Object */
  config: IWidgetSvcConfig;
}

/**
 * Array of Signal K data path configuration.
 *
 * @export
 * @interface IPathArray
 */
export type IPathArray = Record<
  /** Key string use to name/identify the path IWidgetPath object. Used for Observable setup */
  string,
  IWidgetPath
>;



/**
 * Defines all possible Widget configuration properties.
 *
 * @export
 * @interface IWidgetSvcConfig
 *
 */
export interface IWidgetSvcConfig {
  /** The common display name for display. NOTE: This property can be overwritten by metadata. */
  displayName?: string;
  /** The short display name for display (AWS, DPT, SOG, etc.). NOTE: This property can be overwritten by metadata. */
  shortName?: string;
  /** The long display name for display. NOTE: This property can be overwritten by metadata. */
  longName?: string;
  //timeout?: number;     // NOT IMPLEMENTED:tells the consumer how long it should consider the value valid
  /** This object provides information regarding the recommended type and extent of the scale used for displaying values. NOTE: This property can be overwritten by metadata. */
  displayScale?: {
    /** The lower bound of the scale. This is the minimum value that can be represented on the display. NOTE: This property can be overwritten by metadata. */
    lower?: number;
    /** The upper bound of the scale. This is the maximum value that can be represented on the display. NOTE: This property can be overwritten by metadata. */
    upper?: number;
    /** The type of scale to use. This can be 'linear', 'logarithmic', 'squareRoot', 'power' or null if no scale is used (KIP only support linear for now). NOTE: This property can be overwritten by metadata. */
    type: TScaleType;
    /** If scale type is 'power', the power value to use of the display scale */
    power?: number;
  }

  /** Color from KIP selection tool to use as main display color */
  color?: string;
  /** Color from KIP selection tool to use as background color */
  bgColor?: string;
  /** Don't apply any display color */
  noColor?: boolean;
  /** Don't apply any background color */
  noBgColor?: boolean;

  /** Enables data stream to emit null values (permitting Widgets to reset) after a given timeout smoothingPeriod. See dataTimeout */
  enableTimeout?: boolean;
  /** Sets data stream no-data timeout notification in minutes */
  dataTimeout?: number;
  /** Used by multiple Widget: number of fixed decimal places to display */
  numDecimal?: number;
  /** Used by multiple Widget: number of fixed Integer places to display */
  numInt?: number;
  /** Display the mini chart or not flag */
  showMiniChart?: boolean;

  /** The widget's path configuration property used for Observable setup. This property can be either contain an object with one key:string per path with it's value as a IWidgetPath object, or an Array of IWidgetPaths. Array is used by multi-control widgets where key:strings Objects are not appropriate. The Key:string Object should be used for typical widgets. */
  paths?: IPathArray | IWidgetPath[];
  /** Set to True to limit all Widget's data paths selection of the configuration UI Paths panel to Self. ie. the user's vessel. Value of True will prevent listing of all Signal K known paths that come from buoy, towers, other vessels, etc. Else all Signal K know data will be listed for selection. Should be set to True unless you need non-self data paths such as monitoring remote vessels, etc. */
  filterSelfPaths?: boolean;

  /** Array of sub/child component setting */
  multiChildCtrls?: IDynamicControl[];

  /** Gauge type widget property bag */
  gauge?: {
    /** Optional. Gauge component type */
    type: string;
    /** Optional. Gauge subType or layout preset options */
    subType?: string;
    /** Optional. Should gauge ticks be enabled */
    enableTicks?: boolean;
    /** Optional. Should gauge show a progress bar */
    enableProgressbar?: boolean;
    /** Optional. Should gauge show a needle indicator */
    enableNeedle?: boolean;
    /** Optional. Units formatting rule name */
    unitLabelFormat?: string;
    /** Optional. Used ny ngGauge when in compass mode */
    compassUseNumbers?: boolean;
    /** Optional. Used ny ngGauge to show/hide value box */
    showValueBox?: boolean;
    /** Optional. Used by GaugeSteel to set face style */
    backgroundColor?: string;
    /** Optional. Used by GaugeSteel to set face style */
    faceColor?: string;
    /** Optional. Angle (1-360) the progress bar should start. 360 is same as 0 degrees */
    scaleStart?: number;
    /** Optional. Used by GaugeSteel to set radial faceplate size */
    radialSize?: string;
    /** Optional. Used by GaugeSteel to set faceplate rotation */
    rotateFace?: boolean;
    /** Optional. GaugeSteel digital or bar */
    digitalMeter?: boolean;
    /** Optional. Width of gauge highlights */
    highlightsWidth?: number;
    /** Optional. Used by ngRadial to set bar start position */
    barStartPosition?: "left" | "right" | "middle";
    /** Optional. Used by Horizon steelgauge to show or hide the frame */
    noFrameVisible?: boolean;
    /** Optional. Invert the pitch path data */
    invertPitch?: boolean;
    /** Optional. Invert the roll path data */
    invertRoll?: boolean;
    /** Optional. Invert the angle path data */
    invertAngle?: boolean;
    /** Optional. Show the side label on the gauge */
    sideLabel?: boolean;
  }
  /** Used by numeric data Widget: Display minimum registered value since started */
  showMin?: boolean;
  /** Used by numeric data Widget: Display maximum registered value since started */
  showMax?: boolean;

  /** Used by Widgets that support zones: Indicates if SK metadata zones should be applied or not */
  ignoreZones?: boolean;

  /** Option for widget that supports Signal K PUT command */
  putEnable?: boolean;
  /** Option for widget that supports Signal K PUT command */
  putMomentary?: boolean;
  /** Option for widget that supports Signal K PUT command */
  putMomentaryValue?: boolean;

  /** Used by date Widget: configurable display format of the date/time value */
  dateFormat?: string;
  /** Used by date Widget: Time zone value to apply to the data/time value */
  dateTimezone?: string;

  /** Used by wind Widget: enable/disable wind sector UI feature */
  windSectorEnable?: boolean;
  /** Used by wind Widget: duration to track wind shift in the sector UI feature */
  windSectorWindowSeconds?: number;
  /** Used by wind Widget: enable/disable layline UI feature */
  laylineEnable?: boolean;
  /** Used by wind Widget: upwind layline angle of the vessel applied to the UI feature */
  laylineAngle?: number;
  /** Used by wind Widget: enable/disable Waypoint UI feature */
  waypointEnable?: boolean;
  /** Used by wind Widget: enable/disable COG UI feature */
  courseOverGroundEnable?: boolean;
  /** Used by wind Widget: enable/disable current UI feature */
  driftEnable?: boolean;
  /** Used by wind Widget: enable/disable Apparent Wind Speed UI feature */
  awsEnable?: boolean;
  /** Used by wind Widget: enable/disable True Wind Speed UI feature */
  twsEnable?: boolean;
  /** Used by wind Widget: enable/disable True Wind Angle UI indicator feature */
  twaEnable?: boolean;
  /** Used by wind Widget: enable/disable sailSetup UI feature */
  sailSetupEnable?: boolean;

  /** Used by autopilot Widget to configure autopilot settings */
  autopilot?: IAutopilotConfig,

  /** Used by historical data Widget: Set the data conversion format. */
  convertUnitTo?: string | null;

  /** Used to select a group for the convertUnitTo conversion. */
  convertUnitToGroup?: string;

  /** Datachart widget Dataset option: Path for the dataset */
  datachartPath?: string | null,
  /** Datachart widget Dataset option: Source for the dataset */
  datachartSource?: string | null,
  /** Specifies which average data points property the chart dataset will be built with. Values can be: avg, sma, ema, ema */
  datasetAverageArray?: string;
  /** Used by datachart & windtrend chart Widget to set datapoint configuration */
  timeScale?: string;
  /** Used by datachart & windtrend chart Widget to set period configuration */
  period?: number;
  /** Specifies if the chart should track against the average dataset instead of the value (default setting) */
  trackAgainstAverage?: boolean;
  /** Specifies which average data points property (1=avg, 2=ema or 3=dema) the chart dataset will be built with */
  showAverageData?: boolean;
  /** Display chart dataset minimum value line */
  showDatasetMinimumValueLine?: boolean;
  /** Display chart dataset maximum value line */
  showDatasetMaximumValueLine?: boolean;
  /** Display chart dataset average value line */
  showDatasetAverageValueLine?: boolean;
  /** Display chart dataset angle average value line */
  showDatasetAngleAverageValueLine?: boolean;
  /** Display widget title */
  showLabel?: boolean;
  /** Used by historical data Widget */
  animateGraph?: boolean;
  /** Display chart time (x axis) scale */
  showTimeScale?: boolean;
  /** Display chart y scale */
  showYScale?: boolean;
  /** Chart y scale suggested minimum. Scale will extend beyond this number automatically if values are below */
  yScaleSuggestedMin?: number;
  /** Chart y scale suggested maximum. Scale will extend beyond this number automatically if values are above */
  yScaleSuggestedMax?: number;
  /** Chart y scale suggested minimum is zero */
  startScaleAtZero?: boolean;
  /** Limit chart value axis (y) scale to min and max value */
  enableMinMaxScaleLimit?: boolean;
  /** Chart y scale minimum */
  yScaleMin?: number;
  /** Chart y scale maximum */
  yScaleMax?: number;
  /** Inverse Chart Y axis */
  inverseYAxis?: boolean;
  /** Chart data flow direction. True = vertical (top to bottom), False = horizontal (left to right) */
  verticalChart?: boolean;
  /** Chart scale minimum value */
  minValue?: number;
  /** Chart scale maximum value */
  maxValue?: number;

 /** Used by IFrame widget: URL lo load in the iframe */
  widgetUrl?: string;
  /** Used by IFrame widget: allow input on iframe or not */
  allowInput?: boolean;

  /** Use by racetimer widget */
  timerLength?: number;
  /** The next dashboard to display when the racer-timer-widget counts to 0 and the boat is not OCS*/
  nextDashboard?: number;
  /** If true, play beeps when the racer-timer-widget counts to through the minutes, 10s and each of the last 10s. */
  playBeeps?: boolean;
}

export interface IAutopilotConfig {
  /** Set rudder angle inversion */
  invertRudder: boolean;
  /** Set bearing direction type is Magnetic or True */
  courseDirectionTrue: boolean,
  /** Set heading direction type is Magnetic or True */
  headingDirectionTrue: boolean,
  /** Set API version of the autopilot. v1 only supports Signal K autopilot plugin (also known as Raymarine autopilot) */
  apiVersion: "v1" | "v2",
  /** The autopilot provider supports multiple autopilot
   * operating simultaneously. Set the autopilot instance ID to control
   * ('_default', 'pypilot-1', 'pypilot-2', 'raymarine-1', etc.). Use
   * default to control the primary instance selected by the provider -
   * see API for details.
   *
   * V2 only property. In V1 mode, this property is ignored */
  instanceId: string | null,
  /** Set autopilot plugin ID  ('pypilot-autopilot-provider', 'autopilot', etc.). autopilot is the v1 Signal K autopilot plugin ID. */
  pluginId: string | null,
  /** Set autopilot supported operational modes. This is defined by each autopilot plugin */
  modes: string | null,
}

/**
 * A configuration object that defines a sub/child component
 *
 * @export
 * @interface IDynamicControl
 */
export interface IDynamicControl {
  /** Display label of the control */
  ctrlLabel: string;
  /** The type of control: 1 = toggle, 2 = button, 3 = light */
  type: string;
  /** A unique UUID to match against the path key name to link the control/path */
  pathID: string;
  /** The value of the control */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  /** The color of the control */
  color: string;
  /** If the control should use numeric path instead of boolean */
  isNumeric: boolean;
}

/**
 * IDataHighlight interface
 *
 * This interface represents a highlight zone on a gauge. Each highlight zone is
 * defined by a starting point, an ending point, and a color. Zones definitions
 * are defined in Signal K as part of metadata.
 *
 * @property from - The starting point of the highlight zone.
 * @property to - The ending point of the highlight zone.
 * @property color - The color of the highlight zone.
 */
export interface IDataHighlight {
  from: number;
  to: number;
  color: string;
}

/**
 * Defines all possible properties for data paths. Combines both
 * KIP and Signal K path features. Used for widget configuration, UI, and data binding.
 *
 * @example
 * ```typescript
 * // As part of a widget config object:
 * const widgetConfig: IWidgetSvcConfig = {
 *   paths: {
 *     main: {
 *       description: 'Apparent Wind Angle',
 *       path: 'self.environment.wind.angleApparent',
 *       source: null,
 *       pathType: 'number',
 *       isPathConfigurable: true,
 *       sampleTime: 1000
 *     },
 *     hidden: {
 *       description: 'Hidden Path',
 *       path: 'self.hidden.path',
 *       source: null,
 *       pathType: 'number',
 *       isPathConfigurable: false, // Not shown in UI or validated
 *       sampleTime: 1000
 *     }
 *   }
 * };
 * ```
 *
 * Notes:
 * - Only paths with isPathConfigurable: true are included in the widget configuration UI and form validation logic.
 * - Paths with isPathConfigurable: false are hidden from the UI and excluded from validation, allowing for hardcoded or system paths.
 * - See also: {@link TWidgetPathType}, {@link TValidSkUnits}, and unit conversion docs in units.service.
 *
 * @export
 * @interface IWidgetPath
 */
export interface IWidgetPath {
  /** Required: Path description label used in the Widget settings UI */
  description: string | null | '';
  /**
   * Required: Signal K path (ie. self.environment.wind.angleTrueWater) of the data to be received or null value.
   * See KIP's Data Browser or Signal K's Data Browser UI to identify possible available paths.
   * NOTE: Not all setups will have the same paths. Path availability depends on network components and Signal K configuration that exists on each vessel.
   */
  path: string | null;
  /**
   * Required: Enforce a preferred Signal K "data" Source for the path when/if multiple Sources are available (ie. the vessel has multiple depth thru hulls, wind vanes, engines, fuel tanks, etc.).
   * Use null value to use Signal K's default Source configuration. Source defaults and priorities are configured in Signal K.
   */
  source: string | null;
  /**
   * Required: Used by the Widget Options UI to filter the list of Signal K paths the user can select from.
   * Allowed values are defined in {@link TWidgetPathType}.
   * @see TWidgetPathType
   */
  pathType: TWidgetPathType;
  /** Only lists paths that support PUT action. Defaults to false */
  supportsPut?: boolean;
  /**
   * Used to hide the path configuration from the Widget Options UI and exclude it from form validation.
   * Setting this property to `false` prevents users from seeing and changing the path in the UI,
   * and ensures the path is not included in the configuration form or its validation logic.
   * Use this to hardcode a path configuration or for system/hidden paths.
   *
   * Example:
   *   isPathConfigurable: false // Path is hidden and not user-editable
   */
  isPathConfigurable: boolean;
  /**
   * Numeric path type filter to limit path search results based on SK Meta Units.
   * Allowed values are defined in {@link TValidSkUnits}.
   * Use 'unitless' for numeric paths with no meta units, or null to list all types of paths (no filter).
   * @see TValidSkUnits
   */
  pathSkUnitsFilter?: TValidSkUnits;
  /**
   * Show or hide the path form's filter dropdown control bound to
   * pathSkUnitsFilter path property visible in Widget Options UI.
   *
   * This filter is available to paths with number type values.
   */
  showPathSkUnitsFilter?: boolean;
  /**
   * Used in Widget Options UI and by observeDataStream() method to convert Signal K transmitted values to a specified format.
   * Allowed values are defined in {@link unitConversionFunctions}.
   * Also used as a source to identify conversion group.
   * Use null for no conversion.
   *
   * @see units.service unitConversionFunctions()
   */
  convertUnitTo?: string;
  /**
   * Show or hide the path form's Format dropdown control bound to convertUnitTo
   * path property in Widget Options UI.
   *
   * Setting this property to "false" prevents users from seeing
   * and changing the Format for the path's values. Use this to hardcode a
   * format configuration.
   */
  showConvertUnitTo?: boolean;
  /**
   * Required: Used to throttle/limit the path's Observer emitted values
   * frequency and reduce Angular change detection cycles. Configure according
   * to data type and human perception. Value in milliseconds.
   */
  sampleTime: number;
  /** Used as a reference ID when path is an Array and array index is not appropriate. */
  pathID?: string | null | '';
  /** NOT IMPLEMENTED - Signal K - smoothingPeriod=[milliseconds] becomes the transmission rate, e.g. every smoothingPeriod/1000 seconds. Default: 1000 */
  smoothingPeriod?: number;
  /** NOT IMPLEMENTED - Signal K - format=[delta|full] specifies delta or full format. Default: delta */
  format?: TFormat;
  /** NOT IMPLEMENTED - Signal K - policy=[instant|ideal|fixed]. Default: ideal */
  policy?: TPolicy;
  /** NOT IMPLEMENTED - Signal K - minPeriod=[milliseconds] becomes the fastest message transmission rate allowed, e.g. every minPeriod/1000 seconds. This is only relevant for policy='instant' to avoid swamping the client or network. */
  minPeriod?: number;
  /**
   * Optional: Indicates if the path control must have a path value or not.
   * - If true: The control is valid if the path is either a valid (non-empty) path or empty (null or '').
   *   - If the path is set but not valid (malformed), the control is invalid.
   * - If false or undefined: The control behaves as usual (no additional validation).
   *
   * Example:
   *   pathRequired: true // Path must be valid or empty
   */
  pathRequired?: boolean;
}
