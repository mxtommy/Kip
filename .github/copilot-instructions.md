# KIP – Copilot Instructions (for AI coding agents)

Use this quick-start map to be productive in this repo. Prefer these concrete patterns over generic Angular tips. For depth, see COPILOT.md (root) and .github/instructions/angular.instructions.md.

## Big picture
- Angular v20+ PWA served under base path /@mxtommy/kip/ (angular.json baseHref, package.json scripts).
- Data flow: SignalKConnectionService → SignalKDeltaService → DataService → Widgets.
- UI: Dashboard(s) with draggable/resizable widgets (gridstack). Themes: light/dark/night via SCSS roles + CSS variables.
- Storage: Config lives in Signal K when logged in, else local (StorageService). App init via APP_INITIALIZER (AppNetworkInitService).

## Daily workflows
- Dev: npm run dev, then open http://localhost:4200/@mxtommy/kip/ (needs a running Signal K server).
- Build: npm run build-dev | npm run build-prod (outputs to public/ and respects baseHref).
- Quality: npm run lint, npm test (Karma). E2E (Protractor) is legacy/optional.

## Widget contract (critical)
- Extend BaseWidgetComponent (src/app/core/utils/base-widget.component.ts) for every widget.
- Implement startWidget() and updateConfig(config: IWidgetSvcConfig).
- defaultConfig defines initial config; call validateConfig() to merge new properties into saved configs safely.
- Subscriptions: observeDataStream('pathKey', next => ...) for values; observeMetaStream() for zones. Cleanup: destroyDataStreams() in ngOnDestroy.
- Multiple streams: Call observeDataStream once per needed config.paths key. BaseWidget aggregates all under one Subscription; destroyDataStreams() unsubscribes all data and meta streams at once.
- Units: Always go through UnitsService (convertToUnit, formatWidgetNumberValue). Don’t hardcode conversions/formatting.
- Define config.paths[pathKey] with: path, pathType ('number' | 'string' | 'Date' | 'boolean'), sampleTime, convertUnitTo, source.

### observeDataStream features (applied automatically)
- Auto-creates per-path observables from config.paths via createDataObservable() when first used.
- Applies sampleTime from the path config consistently to reduce churn.
- For pathType 'number': performs UnitsService.convertToUnit(convertUnitTo) and optionally timeout+retry.
- For 'string' | 'Date': applies sampleTime and optional timeout/retry (no unit conversion).
- For 'boolean': applies sampleTime (no timeout/retry).
- Global timeouts: enableTimeout + dataTimeout (seconds) at widgetProperties.config level control timeout behavior.

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
- CommonJS deps are explicitly allowed (howler, hammerjs, js-quantities). Avoid introducing new CJS without adding to allowedCommonJsDependencies.
- Use standalone components, signals, @if/@for; follow .github/instructions/angular.instructions.md for style.
- Widget config UIs live under src/app/widget-config; path controls use custom validators (no Validators.required). Respect isPathConfigurable and pathRequired.

## Widgets: do this, not that
- Do: Define a complete defaultConfig (including config.paths) and call validateConfig() before using config. Don’t: Scatter fallback defaults across methods.
- Do: Use observeDataStream(...) and destroyDataStreams() in ngOnDestroy. Don’t: Manually subscribe to DataService in multiple places without centralized cleanup.
- Do: Call observeDataStream once per path key; let BaseWidget aggregate subscriptions. Don’t: Manage multiple Subscription instances yourself—destroyDataStreams() handles all.
- Do: Convert/format with UnitsService and formatWidgetNumberValue(). Don’t: Hardcode unit math (e.g., divide by 0.5144) or toFixed() ignoring widget decimals/min/max.

## Key files/dirs
- Core services: src/app/core/services/ (DataService, SignalKConnectionService, SignalKDeltaService, AppNetworkInitService, UnitsService, DataSetService, NotificationsService).
- Widget base: src/app/core/utils/base-widget.component.ts (subscriptions, units, zones, formatting).
- Widgets: src/app/widgets/ (e.g., widget-numeric, widget-gauge-ng-*, widget-data-chart, widget-windtrends-chart).
- Config UI: src/app/widget-config/ (shared config components, validators, modals).
- Build: angular.json, package.json scripts.

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
