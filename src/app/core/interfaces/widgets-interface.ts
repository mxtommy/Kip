import { Format, Policy } from './signalk-interfaces';

export enum ControlType {
  toggle = 0,
  push = 1,
  indicator = 2,
}

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
 * Description of standard Angular Material Theme colors.
 *
 * @export
 * @interface ITheme
 */
export interface ITheme {
  primary: string;
  accent: string;
  warn: string;
  primaryDark: string;
  accentDark: string;
  warnDark: string;
  background: string;
  text: string;
  textDark: string;
  textPrimaryLight: string;
  textPrimaryDark: string;
  textAccentLight: string;
  textAccentDark: string;
  textWarnLight: string;
  textWarnDark: string;
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
export interface IPathArray {
  /** Key string use to name/identify the path IWidgetPath object. Used for Observable setup */
  [key: string]: IWidgetPath;
}

/**
 * This interface defines all possible Widget configuration settings.
 * Usage: Widgets for configuration storage and Widget Manager service.
 *
 * Note: Used by IWidget interface.
 *
 * @export
 * @interface IWidgetSvcConfig
 *
 */
export interface IWidgetSvcConfig {
  /** The Widget's display label */
  displayName?: string;
  /** Set to True to limit all Widget's data paths selection of the configuration UI Paths panel to Self. ie. the user's vessel. Value of True will prevent listing of all Signal K known paths that come from buoy, towers, other vessels, etc. Else all Signal K know data will be listed for selection. Should be set to True unless you need non-self data paths such as monitoring remote vessels, etc. */
  filterSelfPaths?: boolean;
  /** The widget's path configuration property used for Observable setup. This property can be either contain an object with one key:string per path with it's value as a IWidgetPath object, or an Array of IWidgetPaths. Array is used by multi-control widgets where key:strings Objects are not appropriate. The Key:string Object should be used for typical widgets. */
  paths?: IPathArray | IWidgetPath[];
  /** Use by Autopilot Widget: key should match key in paths, specifies autopilot widget possible paths for AP mode */
  usage?: {
    [key: string]: string[];
  };
  /** Use by Autopilot Widget: key should match key in paths, specifies autopilot widget paths value type for AP mode */
  typeVal?: {
    [key: string]: string;
  };
  /** Array of sub/child component setting */
  multiChildCtrls?: IDynamicControl[];

  /** Enables data stream to emit null values (permitting Widgets to reset) after a given timeout smoothingPeriod. See dataTimeout */
  enableTimeout?: boolean;
  /** Sets data stream no-data timeout notification in minutes */
  dataTimeout?: number;


  /** Used by multiple Widget: number of fixed decimal places to display */
  numDecimal?: number;
  /** Used by multiple Widget: number of fixed Integer places to display */
  numInt?: number;
  /** Used by numeric data Widget: Show minimum registered value since started */
  showMin?: boolean;
  /** Used by numeric data Widget: Show maximum registered value since started */
  showMax?: boolean;

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
  /** Used by wind Widget: enable/disable sailSetup UI feature */
  sailSetupEnable?: boolean;

  /** Used by multiple gauge Widget: defines the UI layout */
  gaugeType?: string;
  /** Used by multiple gauge Widget */
  gaugeUnitLabelFormat?: string;
  /** Used by multiple gauge Widget */
  gaugeTicks?: boolean;
  /** Used by multiple gauge Widget */
  barGraph?: boolean;
  /** Used by multiple gauge Widget */
  backgroundColor?: string;
  /** Used by multiple gauge Widget */
  frameColor?: string;
  /** Used by multiple gauge Widget */
  barColor?: string;
  /** Used by multiple gauge Widget */
  textColor?: string;
  /** Used by multiple gauge Widget */
  radialSize?: string;
  /** Used by multiple Widget to set minimum data range to display. */
  minValue?: number;
  /** Used by multiple Widget to set maximum data range to display. */
  maxValue?: number;
  /** Used by multiple gauge Widget: Should the needle or the faceplate rotate */
  rotateFace?: boolean;
  /** Used by Autopilot Widget: Should the Widget start automatically on load or should the user press Power/On. */
  autoStart?: boolean;
  /** Used by multiple gauge Widget: Use cardinal points or angle numbers as direction labels */
  compassUseNumbers?: boolean;

  /** Used by historical data Widget: Set the data conversion format. !!! Do not use for other Widget !!! */
  convertUnitTo?: string;
  /** Used by historical data Widget */
  datasetUUID?: string;
  /** NOTE: Retired property - Used by historical data Widget */
  invertData?: boolean;
  /** Specifies which average data points property the chart dataset will be built with. Values can be: avg, sma, ema, ema */
  datasetAverageArray?: string;
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
  /** Display chart y scale */
  showYScale?: boolean;
  /** Used by historical data Widget */
  animateGraph?: boolean;
  /** Prevent chart value axis autoscaling. Always start scale from zero */
  startScaleAtZero?: boolean;
  /** Display chart time (x axis) scale */
  showTimeScale?: boolean;
  /** Limit chart value axis scale to min and max value */
  enableMinMaxScaleLimit?: boolean;
  /** Used by historical data Widget */
  verticalGraph?: boolean;

  /** Option for widget that supports Signal K PUT command */
  putEnable?: boolean;
  /** Option for widget that supports Signal K PUT command */
  putMomentary?: boolean;
  /** Option for widget that supports Signal K PUT command */
  putMomentaryValue?: boolean;

 /** Used by IFrame widget: URL lo load in the iframe */
  widgetUrl?: string;

  /** Use by racetimer widget */
  timerLength?: number;
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
  type: ControlType;
  /** A unique UUID to match against the path key name to link the control/path */
  pathID: string;
  /** The value of the control */
  value?: any;
  /** The color of the control */
  color: string;

}

/**
 * Widget Zones data highlights interface. Used to defined how current path data
 * value should be displayed/highlighted with respect to the zones configuration.
 *
 * @exports
 * @interface IDataHighlight
 * @extends {Array<{
 *   from : number;
 *   to : number;
 *   color: string;
 * }>}
 */
export interface IDataHighlight extends Array<{
  from: number;
  to: number;
  color: string;
}> {};

/**
 * Defines all possible properties for data paths. Combines both
 * both KIP and Signal K path features.
 *
 * @interface IWidgetPaths
 */

/**
 *
 *
 * @export
 * @interface IWidgetPath
 */
export interface IWidgetPath {
  /** Required: Path description label used in the Widget settings UI */
  description: string | null | '';
  /** Required: Signal K path (ie. self.environment.wind.angleTrueWater) of the data to be received or null value. See KIP's Data Browser or Signal K's Data Browser UI to identified possible available paths. NOTE: Not all setup will have the same paths. Path availability depends on network components and Signal K configuration that exists on each vessel. */
  path: string | null;
  /** Required: Enforce a preferred Signal K "data" Source for the path when/if multiple Sources are available (ie. the vessel has multiple depth thru hulls, wind vanes, engines, fuel tanks, ect.). Use null value to use Signal K's default Source configuration. Source defaults and priorities are configured in Signal K. */
  source: string | null;
  /** Required: Used by the Widget Options UI to filter the list of Signal K path the user can select from. Format can be: number, string, boolean or null to list all types */
  pathType: string  | null;
  /** NOT IMPLEMENTED - Used by the Widget Options UI to filter path list ie. self.navigation.* or *.navigation.* */
  pathFilter?: string; //TODO: to implement in the future to facilitate sub path selection
  /** Used in Widget Options UI and by observeDataStream() method to convert Signal K transmitted values to a specified format. Also used as a source to identify conversion group. */
  convertUnitTo?: string;
  /** Used by the Widget Options UI to hide the path in the POaths configuration panel went it should not be modified */
  isPathConfigurable: boolean;
  /** Required: Used to throttle/limit the path's Observer emitted values frequency and reduce Angular change detection cycles. Configure according to data type and human perception. Value in milliseconds */
  sampleTime: number;
  /** Used as a reference ID when path is an Array and array index is not appropriate. */
  pathID?: string | null | '';
  /** NOT IMPLEMENTED -Signal K - smoothingPeriod=[milliseconds] becomes the transmission rate, e.g. every smoothingPeriod/1000 seconds. Default: 1000 */
  smoothingPeriod?: number;
  /** NOT IMPLEMENTED -Signal K - format=[delta|full] specifies delta or full format. Default: delta */
  format?: Format;
  /** NOT IMPLEMENTED -Signal K - policy=[instant|ideal|fixed]. Default: ideal */
  policy?: Policy;
  /** NOT IMPLEMENTED -Signal K - minPeriod=[milliseconds] becomes the fastest message transmission rate allowed, e.g. every minPeriod/1000 seconds. This is only relevant for policy='instant' to avoid swamping the client or network. */
  minPeriod?: number;
}
