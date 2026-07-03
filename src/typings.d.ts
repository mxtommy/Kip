// (Removed legacy global NodeModule declaration; @types/node now provides module typings.)
// Keep file to allow adding any project-specific ambient declarations later.

declare module '*.svg?raw' {
	const content: string;
	export default content;
}

declare module '@godind/canvas-gauges' {
	export interface BaseGauge {}
	export interface GenericOptions {}
	export interface LinearGauge {}
	export interface LinearGaugeOptions {}
	export interface RadialGauge {}
	export interface RadialGaugeOptions {}
}

declare module 'express' {
	export interface IRouter {}
}

declare module 'baconjs' {
	export interface Bus<T = unknown, U = unknown> {}
}
