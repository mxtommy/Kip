// Metadata, Notification and Stream Subscription type restrictions.
const states = ["nominal", "normal", "alert", "warn", "alarm", "emergency"] as ["nominal", "normal", "alert", "warn", "alarm", "emergency"];
type State = typeof states[number];

const types = ["linear", "logarithmic", "squareroot", "power"] as ["linear", "logarithmic", "squareroot", "power"];
type Type = typeof types[number];

const methods = ["visual", "sound"] as ["visual", "sound"];
type Method = typeof methods[number];

const formats = ["delta", "full"] as ["delta", "full"];
export type Format = typeof formats[number];

const policies = ["instant", "ideal", "fixed"] as ["instant", "ideal", "fixed"];
export type Policy = typeof policies[number];

/**
 * Not used
 */
export interface IUpdateMessage {
  source: {
    label: string;
    type: string;
    pgn?: string;
    src?: string;
    talker?: string;
  };
  timestamp: string;
  values: {
    path: string;
    value: any;
  }[]
}

/**
 * SignalK Delta low level raw message interface.
 */
export interface IDeltaMessage {
  updates?: IUpdateMessage[];
  requestId?: string;
  state?: string;
  statusCode?: number;
  context: string;
  self?: string;
  version?: string;
  message?: string;
  accessRequest?: {
    permission?: string;
    token?: string
  }
}

/**
 * Kip SignalK path Objects interface. This object is used to contain all server received data
 */
export interface IPathObject {
  path: string;
  defaultSource: string; // default source
  sources: {
    [sourceName: string]: { // per source data
      timestamp: number;
      value: any;
    }
  }
  meta?: ISignalKMetadata;
  type: string;
}

/**
 * SignalK Metadata Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/data_model_metadata.html
 */
export interface ISignalKMetadata {
  // normal state value
  description: string;  //SK base required value
  units: string;         //SK base required value
  displayName?: string;
  longName?: string;
  shortName?: string;
  state?: State;
  timeout?: number;
  method?: Method[];
  displayScale?: {      //This object provides information regarding the recommended type and extent of the scale used for displaying values.
    lower?: number;
    upper?: number;
    type?: Type;
  }
  // elevated state value
  alertMethod?: Method[];
  warnMethod?: Method[];
  alarmMethod?: Method[];
  emergencyMethod?: Method[];
  zones?: {             //This provides a series of hints to the consumer which can be used to properly set a range on a display gauge and also color sectors of a gauge to indicate normal or dangerous operating conditions.
    state: string;
    lower?: number;
    upper?: number;
    message?: string;
  }[]
}

/**
 * Interface for Metadata by Paths
 */
export interface IPathAndMetaObjects {
  path: string;
  meta?: ISignalKMetadata;
}

/**
 * SignalK Notification Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/notifications.html
 */
export interface ISignalKNotification {
  value: {
    method: Method[],
    state: State,
    message: string
  },
  timestamp: string,
  $source: string,
}

export interface IPathInfo {
  path: string;

}
