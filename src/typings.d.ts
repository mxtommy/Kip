// (Removed legacy global NodeModule declaration; @types/node now provides module typings.)
// Keep file to allow adding any project-specific ambient declarations later.

declare module '*.svg?raw' {
	const content: string;
	export default content;
}
