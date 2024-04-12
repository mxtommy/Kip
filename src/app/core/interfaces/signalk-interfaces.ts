/**
 * This file contains Signal K data interfaces.
 *
 * Those interfaces describe the different data types and structures of the
 * Signal K specification. They apply to both REST and WebSocket.
 *
 * For internal Kip data interfaces, see app-interfaces file.
 */

// Metadata, Notification and Stream Subscription type restrictions.
const states = ["nominal", "normal", "alert", "warn", "alarm", "emergency"] as ["nominal", "normal", "alert", "warn", "alarm", "emergency"];
export type TState = typeof states[number];

export enum States {
  Nominal = "nominal",
  Normal = "normal",
  Alert = "alert",
  Warn = "warn",
  Alarm = "alarm",
  Emergency = "emergency"
}

const types = ["linear", "logarithmic", "squareroot", "power"] as ["linear", "logarithmic", "squareroot", "power"];
export type TType = typeof types[number];

export enum Types {
  Linear = "linear",
  Logarithmic = "logarithmic",
  Squareroot = "squareroot",
  Power = "power"
}

const methods = ["visual", "sound"] as ["visual", "sound"];
export type TMethod = typeof methods[number];

export enum Method {
  Visual = "visual",
  Sound = "sound"
}

const formats = ["delta", "full"] as ["delta", "full"];
export type TFormat = typeof formats[number];

export enum Format {
  Delta = "delta",
  Full = "full"
}

const policies = ["instant", "ideal", "fixed"] as ["instant", "ideal", "fixed"];
export type TPolicy = typeof policies[number];

export enum Policy {
  Instant = "instant",
  Ideal = "ideal",
  Fixed = "fixed"
}

/**
 * Services: signalk-delta service
 * Use in: Root Delta interface - Signal K (WebSocket stream) lowest level raw message interface.
 *
 * Description: lowest level object interface of all data updates send by the server. This includes
 * server Hello, request/response (PUTs, login, device token and validation) and data updates.
 *
 * @memberof signalk-interfaces
 */
 export interface ISignalKDeltaMessage {
  // Server Hello message structure
  name?: string;
  roles?: Array<string>;
  self?: string;
  version?: string;
  timestamp?:string;

  // Main data and meta updates structure
  context?: string;
  updates?: ISignalKUpdateMessage[];

  // Request/response response structure
  requestId?: string;
  state?: string;
  statusCode?: number;
  message?: string;

  //    Request/Response to Device Token request response structure
  accessRequest?: {
    permission?: string;
    token: string;
    timeToLive?: number; //not yet implemented on server. Use token data to extract TTL
  };
  //    Request/Response to User login session Token response structure
  login?: {
    token: string;
    timeToLive?: number; //not yet implemented on server. Use token data to extract TTL
  };
  //    Request/Response to Token validation/renewal response structure  ** Not fully implemented in SK. Don,t use for now
  validate?: {
    token?: string;
    timeToLive?: number; //not yet implemented on server. Use token data to extract TTL
  }
  // used as only when something goes wrong server side or when socket status changes (ei. socket closed by server)
  errorMessage?: string;
}

/**
 * Data Update message object interface.
 *
 * Services: signalk-delta service
 * Used in: IDeltaMessage.updates interface properties
 *
 * @memberof signalk-interfaces
 */
export interface ISignalKUpdateMessage {
  $source: string;
  source?: ISignalKSource;
  values: ISignalKDataValueUpdate[];
  timestamp: string;
  meta?: ISignalKMeta[];
}

/**
 * Source update message object interface.
 * Used in: IDeltaMessage.updates.source interface properties
 *
 * @memberof signalk-interfaces
 */
export interface ISignalKSource {
  // common
  label: string;
  type: string;
  // both n2k and I2C sensors
  src?: string;
  // n2k
  deviceInstance?: number;
  pgn?: number;
  // NMEA0183
  talker?: string;
  sentence?: string;
}

/**
 * Value update message object interface.
 * Used in: IDeltaMessage.updates.values.[] interface properties
 *
 * @memberof signalk-interfaces
 */
export interface ISignalKDataValueUpdate {
  path: string;
  value: any;
}

/**
 * Signal K message object interface. Describes meta data received from server.
 *
 * Used by: signalk-delta (parser) and signalk-full (parser) services
 *
 * Included in: IUpdateMessage, IPathFullObject, IPathMetaObject
 *
 * Follow URL for full Signal K specification and description of fields:
 * @url https://signalk.org/specification/1.7.0/doc/data_model_metadata.html
 *
 * When present, metadata can be use for gauge configuration and the state of
 * values in a given scale. It's meant to help automatic gauge configuration, and describe
 * the type of data provided by a given path.
 *
 * @memberof signalk-interfaces
 */
 export interface ISignalKMeta {
  path: string; // not in the spec but always present in the data
  value: ISignalKMetadata;
}

export interface ISignalKMetadata {
  displayName?: string;
  shortName?: string;
  longName?: string;
  description: string;
  units: string;        // required if value is present. describe the type of data
  timeout?: number;     // tells the consumer how long it should consider the value valid
  properties: {}; // Not defined by Kip. Used by GPS and Ship details and other complex data types
  method?: TMethod[];
  displayScale?: {      //This object provides information regarding the recommended type and extent of the scale used for displaying values.
    lower?: number;
    upper?: number;
    type: TType;
    power?: number;
  }
  alertMethod?: TMethod[];
  warnMethod?: TMethod[];
  alarmMethod?: TMethod[];
  emergencyMethod?: TMethod[];
  zones?: {             //This provides a series of hints to the consumer which can be used to properly set a range on a display gauge and also color sectors of a gauge to indicate normal or dangerous operating conditions.
    state: TState;
    lower?: number;
    upper?: number;
    message?: string;
  }[]
}
