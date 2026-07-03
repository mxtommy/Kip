// (Removed legacy global NodeModule declaration; @types/node now provides module typings.)
// Keep file to allow adding any project-specific ambient declarations later.

declare module '*.svg?raw' {
	const content: string;
	export default content;
}

declare module '@godind/canvas-gauges' {
  export type BaseGauge = unknown;
  export type GenericOptions = unknown;
  export type LinearGauge = unknown;
  export type LinearGaugeOptions = unknown;
  export type RadialGauge = unknown;
  export type RadialGaugeOptions = unknown;
}

declare module 'express' {
  export type IRouter = unknown;
}

declare module 'baconjs' {
  export interface Bus<T = unknown, U = unknown> {
    readonly __baconBusBrand?: [T, U];
  }
}
