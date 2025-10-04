# KIP – Copilot Instructions (for AI coding agents)

Use this quick-start map to be productive in this repo. Prefer these concrete patterns over generic Angular tips. For depth, see COPILOT.md (root) and .github/instructions/angular.instructions.md.

## Big picture
- Angular v20+ PWA served under base path /@mxtommy/kip/ (angular.json baseHref, package.json scripts).
- Data flow: SignalKConnectionService → SignalKDeltaService → DataService → Widgets.
- UI: Dashboard(s) with draggable/resizable widgets (gridstack). Themes: light/dark/night via SCSS roles + CSS variables.
- Storage: Config lives in Signal K when logged in, else local (StorageService). App init via APP_INITIALIZER (AppNetworkInitService).

## Daily workflows
- Dev: npm run dev, then open http://localhost:4200/@mxtommy/kip/ (needs a running Signal K server).
- Build KIP app: npm run build:dev | npm run build:prod (outputs KIP to public/ and respects baseHref).
- Build KIP app and KIP plugin: npm run build:all (outputs KIP to public/ and respects baseHref. Outputs plugin to kip-plugin).
- Quality: npm run lint, npm test (Karma). E2E (Protractor) is legacy/optional.

## Host2 widget contract (critical)
All widgets now follow the Host2 architecture (legacy BaseWidgetComponent removed).

1. Standalone component with required functional inputs:
	 ```ts
	 id = input.required<string>();
	 type = input.required<string>();
	 theme = input.required<ITheme | null>();
	 ```
2. Provide a static `DEFAULT_CONFIG: IWidgetSvcConfig` fully describing initial config (paths + options).
3. Inject directives for runtime + streams (and optionally metadata):
	 ```ts
	 private runtime = inject(WidgetRuntimeDirective);
	 private streams = inject(WidgetStreamsDirective);
	 // optional
	 // private meta = inject(WidgetMetadataDirective);
	 ```
4. Register data observers in a single effect:
	 ```ts
	 effect(() => {
		 const cfg = this.runtime.options();
		 if (!cfg) return;
		 untracked(() => {
			 if (cfg.paths?.numericPath?.path) {
				 this.streams.observe('numericPath', pkt => this.value.set(pkt?.data?.value ?? null));
			 }
			 // repeat for other path keys
		 });
	 });
	 ```
5. Always guard for missing config or optional paths (check `cfg?.paths?.key?.path`).
6. Avoid mutating the merged config object; store transient UI state in signals.
7. Use UnitsService and existing formatting helpers; do not hardcode conversions. Using streams directive handles path unit conversion settings automatically for number types.
8. Timeout settings honored automatically (`enableTimeout`, `dataTimeout`)—`WidgetStreamsDirective`.
9. Provide meaningful path keys (e.g. `numericPath`, `headingTrue`, `windSpeed`) and keep them stable.
10. Destroy logic is usually implicit (streams directive centralizes subscriptions); only tear down custom resources manually if you allocate them (e.g., canvases, animation frames).

### Path definition recap
Each entry in `DEFAULT_CONFIG.paths`:
```ts
someKey: {
	description: 'User label',
	path: 'navigation.speedThroughWater',
	pathType: 'number' | 'string' | 'Date' | 'boolean',
	convertUnitTo: 'knots',       // For numeric path only. Sets automatic conversion to this unit
	sampleTime: 1000,              // ms, typical 500+
	source: null,                 // optional source selection. null = default source
	isPathConfigurable: true,     // false to hide path in path options UI
	pathRequired: true,           // set false for optional
	showPathSkUnitsFilter: false, // Show numeric UI filter support
	pathSkUnitsFilter: null       // Set and apply a path unit filter (e.g. 'knots' for speed)
}
```

### Data stream behavior (via WidgetStreamsDirective)
- Respects per-path `sampleTime`.
- Converts units for number paths using UnitsService.
- Optional timeout logic based on widget config flags.
- Centralized unsubscribe when host destroys the widget.

### Embedded widgets (composite pattern)
Use this patterns when a parent widget (e.g. Autopilot) displays other widgets:

#### `<widget-embedded>`
Supply a complete `widgetProperties` object (no persistence writes):
```ts
xteWidgetProps = {
	uuid: this.id() + '-xte',
	type: 'widget-numeric',
	config: {
		type: 'widget-numeric',
		title: 'XTE',
		paths: { numericPath: { description: 'Cross Track Error', path: 'navigation.course.crossTrackError', pathType: 'number', convertUnitTo: 'nm', sampleTime: 1000, isPathConfigurable: false } },
		numDecimal: 2
	}
};
```
Template:
```html
<widget-embedded [widgetProperties]="xteWidgetProps"></widget-embedded>
```
`widget-embedded` internally wires runtime + streams + metadata and instantiates the child.

### Safety patterns
- Null guard every `runtime.options()` access in effects & template (`runtime.options()?.paths?.key`).
- Avoid repeated `runtime.options()` chains in template: expose a computed `cfg = computed(() => this.runtime.options())`.
- For performance, do all `streams.observe` calls in one untracked block.

## Widget path options (important)
- pathType: Controls pipeline behavior (see features above). Must be accurate: 'number' | 'string' | 'Date' | 'boolean'.
- path: Signal K path string (e.g., navigation.speedThroughWater). Empty allowed only when pathRequired=false.
- sampleTime: Sampling period for the observer (ms). Keep modest (e.g., 250–1000) to reduce churn.
- convertUnitTo: Target display unit understood by UnitsService (e.g., 'knots', 'celsius', 'deg'). If omitted, treat value as base/metadata unit.
- source: Optional Signal K source filter; omit to accept any uniquely available source.
- isPathConfigurable: When false, hides the path from the widget-config UI (for fixed/internal paths). Validation is skipped for this key.
- pathRequired: Defaults to true. When false, empty path is valid; your widget must handle “no path” gracefully (don’t subscribe; show placeholder).
- Timeouts: At widgetProperties.config level, enableTimeout + dataTimeout are respected by observeDataStream—don’t add custom timeouts downstream.

## Data, metadata, zones
- Use DataService for values and metadata. observeDataStream wraps DataService.subscribePath.
- zones$ emits Signal K zones metadata when observeMetaStream is used; map states to theme roles.

## Theming
- TS: live theme via this.theme().<role> (from AppService.cssThemeColorRoles$).
- SCSS: use variables from src/themes/_m3*.scss; avoid hardcoded hex.

## Datasets & charts
- Historical/trend data: DataSetService (src/app/core/services/data-set.service.ts). Create/update/remove in widget lifecycle.
- Example: src/app/widgets/widget-windtrends-chart uses Chart.js + date-fns and DataSetService for batch-then-live streams.

## Signal K PUT/requests
- Read via DataService; write via SignalKRequestsService. UI filters PUT-enabled paths (see src/assets/help-docs/putcontrols.md).

## Project specifics & gotchas
- Always respect serve path /@mxtommy/kip/ (dev/prod). Assets and routing assume this base.
- CommonJS deps are explicitly allowed (howler, js-quantities). Avoid introducing new CJS without adding to allowedCommonJsDependencies.
- Use standalone components, signals, @if/@for; follow .github/instructions/angular.instructions.md for style.
- Widget config UIs live under src/app/widget-config; path controls use custom validators (no Validators.required). Respect isPathConfigurable and pathRequired.

## Widgets: do this, not that (Host2)
- Do: Provide a complete `DEFAULT_CONFIG` with all paths & options. Don’t: Scatter defaults across lifecycle hooks.
- Do: Centralize `streams.observe` calls in a single effect. Don’t: Register observers in multiple hooks.
- Do: Keep transient state in signals. Don’t: Mutate merged config objects.
- Do: Use UnitsService / formatting helpers. Don’t: Hardcode conversion factors.
- Do: Guard `options()` & path existence. Don’t: Assume presence.
- Do: Use widget-embedded or inline directives for composites. Don’t: Reintroduce legacy host wrappers.

## Key files/dirs
- Core services: `src/app/core/services/` (DataService, SignalKConnectionService, SignalKDeltaService, AppNetworkInitService, UnitsService, DataSetService, NotificationsService)
- Directives: `src/app/core/directives/` (widget-runtime, widget-streams, widget-metadata)
- Widgets: `src/app/widgets/` (e.g., widget-numeric, widget-gauge-ng-*, widget-data-chart, widget-windtrends-chart, widget-autopilot)
- Embedded host: `src/app/core/components/widget-embedded/`
- Config UI: `src/app/widget-config/`
- Build: `angular.json`, `package.json` scripts

## Debugging
- Use Data Inspector (src/app/core/components/data-inspector) to verify live paths/metadata.
- Dev with source maps: npm run dev. Watch console from DataService/DataSetService for timeouts/lifecycle logs.
- Embeds (widget-iframe): prefer same-origin or relative URLs to avoid CORS and input-injection limits (see embedwidget.md).

## SVG Animation Helpers (rAF)
High-frequency SVG updates (rotations, path morphs) should NOT trigger Angular change detection every frame.

Core utilities (src/app/widgets/utils/svg-animate.util.ts):
- animateRotation(el, fromDeg, toDeg, durationMs, onDone?, ngZone?)
- animateRudderWidth(rectEl, from, to, durationMs, onDone?, ngZone?)
- animateAngleTransition(fromDeg, toDeg, durationMs, applyFn(angle), onDone?, ngZone?)
- animateSectorTransition(fromAngles, toAngles, durationMs, applyFn(sector), onDone?, ngZone?)

Pattern:
1. Inject NgZone; pass it so frames run outside Angular.
2. Cancel prior frame id before starting a new conceptual animation (store returned id from the generic helpers).
3. Skip tiny angle deltas (< ~0.25°) to prevent jitter.
4. On destroy: cancel outstanding ids (including those tracked internally for animateRotation/animateRudderWidth via element refs).

Example (angle interpolation):
```
if (this.portLaylineAnimId) cancelAnimationFrame(this.portLaylineAnimId);
this.portLaylineAnimId = animateAngleTransition(
	prev,
	next,
	300,
	angle => this.drawLayline(angle, true),
	() => { this.portLaylineAnimId = null; },
	this.ngZone
);
```

See COPILOT.md Section 12 for full rationale, cancellation rules, and future extension ideas.
