/**
 * This file contains Signal K data interfaces.
 *
 * Those interfaces describe the different data types and structures of the
 * Signal K specification. They apply to both REST and WebSocket.
 *
 * For internal Kip data interfaces, see app-interfaces file.
 */

// Metadata, Notification and Stream Subscription type restrictions.
export const states = ["normal", "nominal", "alert", "warn", "alarm", "emergency"] as const;
export type TState = typeof states[number];

export enum States {
  Normal = "normal",
  Nominal = "nominal",
  Alert = "alert",
  Warn = "warn",
  Alarm = "alarm",
  Emergency = "emergency"
}

export const types = ["linear", "logarithmic", "squareroot", "power"] as const;
export type TScaleType = typeof types[number];

export enum ScaleTypes {
  Linear = "linear",
  Logarithmic = "logarithmic",
  Squareroot = "squareroot",
  Power = "power"
}

type methods = ["visual", "sound"];
export type TMethod = methods[number];

export enum Methods {
  Visual = "visual",
  Sound = "sound"
}

type formats = ["delta", "full"];
export type TFormat = formats[number];

export enum Formats {
  Delta = "delta",
  Full = "full"
}

export const policies = ["instant", "ideal", "fixed"] as const;
export type TPolicy = typeof policies[number];

export enum Policies {
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
  roles?: string[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  value: ISkMetadata;
}

export interface ISkMetadata {
  displayName?: string;
  shortName?: string;
  longName?: string;
  description: string;
  supportsPut?: boolean; // true if the path supports PUT (write) requests
  units: string;        // required if value is present. Describe the SK type of data
  timeout?: number;     // tells the consumer how long it should consider the value valid
  properties: object; // Not defined by Kip. Used by GPS and Ship details and other complex data types
  method?: TMethod[];
  displayScale?: ISkDisplayScale
  alertMethod?: TMethod[];
  warnMethod?: TMethod[];
  alarmMethod?: TMethod[];
  emergencyMethod?: TMethod[];
  zones?: ISkZone[];
}

export interface ISkDisplayScale {
    lower?: number;
    upper?: number;
    type: TScaleType;
    power?: number;
}

export interface ISkZone {
  state: TState;
  lower?: number;
  upper?: number;
  message?: string;
}

/**
 * Signal K Notification message object interface.
 *
 * Follow URL for full Signal K specification and description of fields:
 * @url https://signalk.org/specification/1.7.0/doc/request_response.html
 *
 * @memberof signalk-interfaces
 */
export interface ISignalKNotification {
  method: TMethod[],
  state: TState,
  message: string
  timestamp: string,
}
