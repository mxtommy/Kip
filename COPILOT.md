# COPILOT.md

## 1. Project Overview
KIP Instrument MFD is an advanced and versatile marine instrumentation package designed to display Signal K data in a modern, customizable dashboard, on boats. It provides real-time visualization of navigation, wind, engine, and other marine data streams offered by Signal K, supporting a wide range of widgets and configuration options. The project aims to deliver a user-friendly, extensible, and visually appealing interface for both professional and recreational marine users.

- **Key technologies:** Angular (v20+), Angular Material, Signal K, TypeScript, SCSS.

---

## 2. Architecture & Structure
- **Main folders:**  
  - `src/app/`: Main application code.
  - `src/app/widgets/`: Widget components (e.g., wind, autopilot).
  - `src/app/widget-config/`: Widget configuration components and logic.
  - `src/app/core/`: Core services, interfaces, and utilities.
- **Component structure:**  
  - Each widget has its own component, template, and theme SCSS in `src/app/widgets/`.
  - All widget configuration logic and UI is centralized and handled independently by components in `src/app/widget-config/`.
  - Creating a new widget does not require changes to `src/app/widget-config/` unless your widget introduces new configuration properties or needs a custom config UI.
  - The main configuration form logic is in `src/app/widget-config/modal-widget-config/`. For unique widget config needs, you may add a new config component (e.g., `modal-widget-<name>-config`).
  - Widget logic/UI and widget configuration are separate concepts that work together.

---

## 4. Conventions & Patterns
- **Naming:**  
  - Use descriptive, camelCase names for variables and controls.
  - Widget config properties match the widget’s function (e.g., `trueWindAngle`, `drift`).
- **Forms:**  
  - Use Angular Reactive Forms for all configuration UIs.
  - Group related controls in form groups.
- **Theming:**  
  - Use SCSS mixins for light/dark themes.
  - Theme mixins must be included in global or component styles.

---

## 5. Development Workflow
- **Linting:**  
  - Run `npm run lint` before every commit (enforced with Husky pre-commit hook).
- **Testing:**  
  - _To be defined._
- **Build & Serve:**  
  - `npm run dev` for development server.
  - `npm run build:dev` for KIP only development build.
  - `npm run build:prod` for KIP only production build.
  - `npm run build:all` for KIP and KIP plugin production build.

---

## 6. Documentation & Comments
- **Document all custom validators and business rules.**
- **Update this file and the README with any major changes or new patterns.**

---


## 8. Core Service Summaries
All major services in `src/app/core/services/` are summarized below for Copilot and developer context. Each entry includes purpose, key methods/responsibilities, dependencies, and usage notes.

- **AppNetworkInitService (`app-initNetwork.service.ts`)**
  - Purpose: Loads network services (Signal K connection, authentication, Storage Service) and retrieves configurations from the Signal K server and loaded it before app startup using Angular's `APP_INITIALIZER`.
  - Key methods: `initNetworkServices()`, config loading, login management.
  - Dependencies: SignalKConnectionService, AuthenticationService, StorageService, DataService, SignalKDeltaService.
  - Usage: Ensures network, authentication, Storage Service and configuration are ready before app bootstraps.

- **AuthenticationService (`authentication.service.ts`)**
  - Purpose: Handles user/device authentication with the Signal K server.
  - Key methods: `login()`, `logout()`, token management, exposes `isLoggedIn$` observable.
  - Dependencies: SignalKConnectionService, HttpClient.

  - Purpose: Centralizes all app dialogs using Angular Material.
  - Dependencies: MatDialog, Dialog components.
  - Usage: Used throughout the app to open modals and dialogs for user interaction.

- **SignalKConnectionService (`signalk-connection.service.ts`)**
  - Purpose: Manages the WebSocket connection to the Signal K server, including reconnect logic and status tracking.
  - Key methods: `connect()`, `disconnect()`, status observables.
  - Dependencies: WebSocket, AuthenticationService.

- **SignalKDeltaService (`signalk-delta.service.ts`)**
  - Purpose: Handles real-time delta updates from Signal K, distributing data to widgets and services.
  - Key methods: Delta subscription, data distribution.
  - Dependencies: SignalKConnectionService, DataService.

- **DataService (`data.service.ts`)**
  - Purpose: Central data provider for Signal K and other sources; handles subscriptions, value updates, and metadata management.
  - Key methods: `subscribeToPath()`, `getValue()`, `getMetadata()`, data and metadata update distribution.
  - Dependencies: SignalKDeltaService, StorageService.

- **AppService (`app-service.ts`)**
  - Purpose: Centralizes app-wide utilities, notifications, and theme management.
  - Key methods: Notification helpers, theme switching, app-level utilities.
  - Dependencies: Angular core, theme and notification services.

- **UIEventService (`uiEvent.service.ts`)**
  - Purpose: Manages UI events such as drag, fullscreen, wake lock, and hotkeys.
  - Key methods: Event emitters, hotkey handlers.
  - Dependencies: Angular core, browser APIs.

- **AppSettingsService (`app-settings.service.ts`)**
  - Purpose: Manages persistent app settings, user preferences, and configuration storage.
  - Key methods: `getSetting()`, `setSetting()`, config file management.
  - Dependencies: StorageService.

- **StorageService (`storage.service.ts`)**
  - Purpose: Provides persistent storage for app data, settings, and user preferences.
  - Key methods: `getItem()`, `setItem()`, config file management.
  - Dependencies: LocalStorage, IndexedDB, or similar.

- **NotificationsService (`notifications.service.ts`)**
  - Key methods: Notification state management, audio/visual alerts, muting.
  - Dependencies: AppSettingsService, DataService, SignalkRequestsService, Howler.

- **CanvasService (`canvas.service.ts`)**
  - Purpose: Provides drawing and rendering utilities for widgets and dashboard components.
  - Key methods: Canvas context helpers, drawing utilities.
  - Dependencies: None (core Angular).

- **DashboardService (`dashboard.service.ts`)**
  - Purpose: Handles dashboard layout, widget arrangement, and dashboard state.
  - Key methods: Layout management, widget arrangement, dashboard state.
  - Dependencies: StorageService, WidgetService.

- **DataSetService (`data-set.service.ts`)**
  - Purpose: Manages data sets, including loading, saving, and updating widget data sources.
  - Key methods: Data set CRUD, data source updates.
  - Dependencies: DataService, StorageService.

- **SignalKPluginsService (`signalk-plugins.service.ts`)**
  - Purpose: Manages Signal K plugin discovery, configuration, and state.
  - Key methods: Plugin list management, config updates.
  - Dependencies: SignalKConnectionService, DataService.
  - Usage: Used to manage plugins and their configuration.

- **SignalKRequestsService (`signalk-requests.service.ts`)**
  - Purpose: Handles requests to the Signal K server, such as PUT/POST operations and custom actions.
  - Key methods: `sendRequest()`, custom action handlers.
  - Dependencies: SignalKConnectionService, DataService.

- **TimersService (`timers.service.ts`)**
  - Purpose: Centralized timer utility for app and widgets, supporting intervals, timeouts, and scheduling.
  - Key methods: Timer creation, interval management.
  - Dependencies: Angular core.

- **UnitsService (`units.service.ts`)**
  - Purpose: Handles unit conversion and formatting for all displayed data.
  - Key methods: `convert()`, `format()`, unit preference management.
  - Dependencies: AppSettingsService.

- **WidgetService (`widget.service.ts`)**
  - Purpose: Manages widget registration, configuration, and lifecycle.
  - Key methods: Widget registration, config helpers, lifecycle management.
  - Dependencies: DashboardService, DataService.

---

## 9. Host2 Widget Architecture

Modern widgets follow a composition pattern built on directives + signals (no inheritance).

### 9.1 Core Contract
- Required signal inputs: `id`, `type`, `theme`.
- Static `DEFAULT_CONFIG` defines all paths, options, and defaults.
- Inject directives:
  - `WidgetRuntimeDirective` – merged persisted config (`options()`), id, sizing.
  - `WidgetStreamsDirective` – path observers (sampling, unit conversion, timeout logic).
  - `WidgetMetadataDirective` (optional) – zones & metadata; call `observe(pathKey)` when needed.
- Register all `streams.observe` calls inside one `effect()` using a single `untracked()` block.
- Use signals for UI state; never mutate merged config object.
- Optional zones highlights via `getHighlights` utility.

Minimal pattern:
```
effect(() => {
  const cfg = this.runtime.options();
  if (!cfg) return;
  untracked(() => {
    const p = cfg.paths['signalKPath'];
    if (p?.path) {
      this.streams.observe('signalKPath', pkt => this.value.set(pkt?.data?.value ?? null));
      this.metadata?.observe?.('signalKPath'); // zones optional
    }
  });
});
```

### 9.2 Zones
- Zones classify value ranges (alert/warn/alarm).
- `path.data.state` may be present even without explicit zones observation.
- Build visual overlays (gauges/charts) from `metadata.zones()` + theme + display scale using `getHighlights`.
- Always guard missing `zones`, `theme`, or scale (return empty array when absent).

### 9.3 Path Configuration Rules
- `isPathConfigurable=false` hides path from UI.
- `pathRequired=false` allows empty path (no subscription until user sets one).
- Always null-guard before observing a path.

### 9.4 Metadata, Units & Conversion
- Signal K schema supplies base SI units; unknown/custom paths might omit units (treat as unitless).
- Numeric paths with `convertUnitTo` leverage `UnitsService` automatically via streams.
- Avoid manual conversion logic; extend `UnitsService` if a gap exists.

### 9.5 Best Practices
- One effect for observer setup.
- Group observer registrations in a single `untracked()` for performance.
- Use signals + `computed() or linkedSignal()` for derived values; avoid heavy template expressions.
- Keep sample times modest (≥1000ms) unless rapid updates are essential.
- Avoid expensive recalculations inside templates—precompute with `computed() or linkedSignal()`.
- Use CanvasService for high-DPI text/gauge rendering instead of manual scaling.
---

## 10. KIP Colors, Theming, and Widget Best Practices

- **KIP Color & Theming Concepts:**
  - KIP uses a centralized theme system with color roles defined in SCSS and exposed to TypeScript via CSS variables and the `AppService`.
  - Theme colors (e.g., `contrast`, `blue`, `zoneAlarm`, `background`, etc.) are defined in SCSS files (`styles.scss`, theme partials) and mapped to CSS variables (e.g., `--kip-blue-color`).
  - The `AppService` provides a `cssThemeColorRoles$` observable and a `theme()` signal for accessing current theme colors in TypeScript.
  - Theme switching (light, dark, night) is handled by toggling classes on `<body>` and updating CSS variables.
  - All widgets should use theme colors for UI consistency and accessibility.

- **Best Practices for Using Colors & Theming in Widgets:**
  - **TypeScript:**
    - Access theme colors via `this.theme().<colorRole>` (e.g., `this.theme().zoneAlarm`, `this.theme().contrast`).
    - Never hardcode color hex values in widget TypeScript; always use theme roles.
    - For dynamic coloring (e.g., based on state/zones), use the correct theme role for each state (see `zoneAlarm`, `zoneWarn`, etc.).
    - Use the color mapping pattern as in `getColors()` for supporting multiple color roles and dim/dimmer variants.
    - When updating widget visuals (e.g., gauge, highlights), always update with theme colors to support live theme switching.
  - **SCSS:**
    - Use CSS variables (e.g., `var(--kip-blue-color)`) for all color assignments in widget/component styles.
    - Do not use static hex codes; always reference a theme variable.
    - For custom widget styles, define new CSS variables in the theme partials if needed, and use them in your SCSS.
    - Use the `.light-theme`, `.night-theme`, and default (dark) selectors to override variables for each theme as needed.
    - Use SCSS mixins for reusable style patterns and to support theme switching.
  - **General:**
    - Always test widgets in all themes (light, dark, night) to ensure colors are accessible and visually correct.
    - Use theme roles for all UI elements, including backgrounds, borders, text, and highlights.
    - For state-based coloring (e.g., alarms, warnings), use the corresponding zone color from the theme.
    - Avoid inline styles for colors; prefer class-based or variable-based styling.
---

## 11. Additional Instructions & Cross-References

### **Related Instruction Files:**
- **README.md**: Project overview, setup instructions, and development guidelines
- **`.github/instructions/angular.instructions.md`**: Detailed Angular v20+ coding standards, component patterns, and framework-specific best practices

### **Instruction Hierarchy:**
1. **Primary**: This `COPILOT.md` file (KIP-specific project guidelines and architecture)
2. **Secondary**: `.github/instructions/angular.instructions.md` (Angular framework standards and modern patterns)
3. **Tertiary**: `README.md` (General project information and setup)

### **Usage Notes:**
- All Angular development should follow both this COPILOT.md file AND the angular.instructions.md guidelines
- When conflicts arise, KIP-specific guidelines in this file take precedence over general Angular patterns
- For widget development, use the Host2 widget architecture (sections 9 & 13) – standalone components + directives (no inheritance)
- For general Angular coding (components, services, forms, component), follow the modern Angular v20+ patterns in angular.instructions.md

---

## 12. SVG Animation Utilities (requestAnimationFrame Helpers)

High-performance SVG animations in KIP (e.g., wind steering dial laylines, sector bands, rotating indicators) use a small set of utilities found in `src/app/widgets/utils/svg-animate.util.ts` to ensure:

- No unnecessary Angular change detection on every animation frame
- Consistent easing and shortest‑path angle interpolation
- Centralized cancellation logic (preventing overlapping animations per element/concern)
- Readable, minimal widget component code

### 12.1 Design Principles
1. Run frame loops outside Angular's `NgZone` to avoid triggering change detection ~60 times/sec.
2. Only re-enter the zone once per animation (on completion callback) if UI state needs Angular binding updates.
3. Gate “tiny” animations (angle deltas below a threshold) to avoid visual jitter and wasted work.
4. Always animate the shortest angular path (wrap via ±180 logic) for rotational continuity.
5. Provide generic primitives (angle + sector interpolation) so components don’t duplicate interpolation math.

### 12.2 Provided Functions
| Function | Purpose | Key Inputs | Notes |
|----------|---------|-----------|-------|
| `animateRotation(el, fromDeg, toDeg, durationMs, onDone?, ngZone?)` | Smoothly rotates an SVG element (`transform: rotate(...)`) | Element, start+end angles, duration | Tracks per-element frame id internally (WeakMap) so a new call cancels the prior rotation for that element. |
| `animateRudderWidth(rectEl, fromWidth, toWidth, durationMs, onDone?, ngZone?)` | Interpolates a `<rect>` width | SVGRectElement, numeric widths | Same outside-zone strategy; width set via `setAttribute`. |
| `animateAngleTransition(fromDeg, toDeg, durationMs, applyFn, onDone?, ngZone?)` | Generic angle interpolation (no DOM assumptions) | Angles, duration, callback(angle) | Use for derived geometry (e.g., computing a path string). |
| `animateSectorTransition(from: SectorAngles, to: SectorAngles, durationMs, applyFn, onDone?, ngZone?)` | Interpolates a structured group of three related angles (`min, mid, max`) | Objects with `{min, mid, max}` | Uses same angle normalization per field + easing. |

`SectorAngles` interface:
```
interface SectorAngles { min: number; mid: number; max: number; }
```

### 12.3 NgZone Strategy
All helpers accept an optional `NgZone`. When provided they:
1. Call `ngZone.runOutsideAngular()` wrapping the frame loop.
2. Use `requestAnimationFrame` until elapsed >= duration.
3. Apply easing (cubic in/out) and normalized shortest-path interpolation.
4. On final frame, invoke `onDone` inside Angular (`ngZone.run(...)`) so any bound template values update once.

If `ngZone` is omitted they still function (pure browser environment) — suitable for non-Angular contexts or tests.

### 12.4 Cancellation Rules
- `animateRotation` & `animateRudderWidth` internally keep a WeakMap<Element, frameId>; a new call replaces the old.
- Callers of `animateAngleTransition` / `animateSectorTransition` receive the raw `frameId` and MUST store & cancel it if a new animation is started for the same conceptual target (e.g., a layline or sector band) before completion.
- Always cancel outstanding frame ids in `ngOnDestroy` to avoid orphan rAF callbacks if the component is torn down mid-animation.

### 12.5 Angle Handling Details
- Input angles are normalized to [0, 360).
- Delta uses wrapped signed difference: `((to - from + 540) % 360) - 180` for shortest path.
- Interpolated angle = `from + easedT * delta`; final angle normalized again.
- A small epsilon (e.g., ~0.25°) can be used by callers to skip tiny animations; component sets `EPS_ANGLE` constant.

### 12.6 Easing
Currently a fixed cubic ease-in-out: `t < 0.5 ? 4t^3 : 1 - pow(-2t + 2, 3)/2`. Chosen for smooth acceleration/deceleration without overshoot. If future needs arise, expose an optional easing parameter (keep backward compatibility by defaulting to cubic in/out).

### 12.7 Usage Patterns

Rotate an indicator:
```
this.animationFrameIds.set(
  el,
  animateRotation(el, currentAngle, targetAngle, 300, () => { /* one-time post animation logic */ }, this.ngZone)
);
```

Animate a layline path angle:
```
if (this.portLaylineAnimId) cancelAnimationFrame(this.portLaylineAnimId);
this.portLaylineAnimId = animateAngleTransition(
  prevAngle,
  nextAngle,
  300,
  angle => this.updateLaylinePath(angle, /* isPort= */ true),
  () => { this.portLaylineAnimId = null; },
  this.ngZone
);
```

Animate a wind sector (three angles):
```
if (this.portSectorAnimId) cancelAnimationFrame(this.portSectorAnimId);
this.portSectorAnimId = animateSectorTransition(
  previousSector,
  newSector,
  300,
  sector => this.updateSectorPath(sector, true),
  () => { this.portSectorAnimId = null; },
  this.ngZone
);
```

### 12.8 When NOT to Animate
- First render / initialization where the user has no prior visual expectation — just set final state.
- Discontinuous jumps (e.g., compass wrap after data gap) that would produce a long spin — snap instead.
- Extremely small (< epsilon) changes — update instantly.

### 12.9 Testing Tips
- For deterministic unit tests, inject a mock `performance.now()` / substitute a manual time advance, or abstract the timestamp acquisition behind a seam if greater test coverage is required.
- Validate shortest-path logic with cases like `from=350 → to=10` (should rotate +20°, not -340°).
- Confirm cancellation by firing a second animation mid-way; the first should not apply further frames.

### 12.10 Future Extensions (Backlog Ideas)
- Optional custom easing function parameter.
- Support for group animations (batch multiple angle transitions under one rAF loop for micro-optimizations).
- Auto-prefetch “snap if > threshold degrees” heuristic inside helpers (today caller decides).

---

## 13. create-host2-widget Schematic (Host2 Widget Generator)

The `create-host2-widget` schematic scaffolds a production-ready Host2 widget with optional zones support, tests, and README guidance. It enforces current architectural patterns (signals + directives) and reduces manual registration effort.

### 13.1 When To Use
Use the schematic for any new widget that:
- Consumes one (or more, to be added later) Signal K path values.
- Requires standard lifecycle (config merging, unit conversion, timeout handling) via `WidgetRuntimeDirective` + `WidgetStreamsDirective`.
- Optionally needs zones metadata visualization.

### 13.2 Invocation Examples
Minimal (interactive prompts for all options):
```
npm run generate:widget
```
or
```
ng g create-host2-widget
```

Non-interactive with explicit options:
```
npx schematics ./tools/schematics/collection.json:create-host2-widget \
  --name tides-chart \
  --title "Tides Chart" \
  --registerWidget Core \
  --pathType number \
  --pathDefault navigation.speedThroughWater \
  --zonesSupport=false \
  --addSpec=true \
  --todoBlock=false \
  --readme=true
```

### 13.3 Options Reference
| Option | Values / Type | Default | Purpose | Notes |
|--------|---------------|---------|---------|-------|
| `name` | string (kebab-case) | — (required) | Base name (component selector becomes `widget-<name>`) | Must be unique under `src/app/widgets/` |
| `title` | string | — (required) | Display title (Add Widget dialog) | Used in WidgetService definition object |
| `registerWidget` | `Core | Gauge | Component | Racing | No` | — | Auto-register in `widget.service.ts` or skip | `No` (case-insensitive) means skip registration |
| `pathType` | `number|string|boolean|Date` | `number` | Primary path value type | Influences stream conversion & formatting |
| `pathDefault` | string/null | `null` | Pre-filled Signal K path | Leave null if unsure |
| `zonesSupport` | boolean | `false` | Include zones metadata scaffolding | Adds metadata directive & highlights logic placeholder |
| `addSpec` | boolean | `true` | Generate spec test file | Basic presence test; extend manually |
| `todoBlock` | boolean | `true` | Include instructional TODO comments | Set false for clean production scaffold |
| `readme` | boolean | `true` | Generate widget README | Developer-focused quick guide |
| `debugLogging` | boolean | `false` | Verbose schematic execution logs | Helpful when troubleshooting formatting/registration |

Hidden defaults inserted into templates: `sampleTime=1000`, `convertUnitTo=null`, placeholder icon & description (replace post-gen).

### 13.4 Generated Artifacts
- `widget-<name>.component.ts|html|scss` – Host2 component & view.
- Optional `widget-<name>.component.spec.ts` when `--addSpec=true`.
- Optional `README.md` (widget-local developer instructions) when `--readme=true`.
- Service registration (import, component map entry, widget definition object) unless `registerWidget=No`.

### 13.5 Post-Generation Checklist
- Replace placeholder icon (`placeholder-icon`) with an actual symbol id in `src/assets/svg/icons.svg` and update `widget.service.ts` entry.
- Write a concise, user-facing description in the WidgetService definition object.
- Adjust `DEFAULT_CONFIG.displayName` and color.
- Decide whether to keep or remove TODO comments (regen with `--todoBlock=false` once stable).
- Add any additional paths (with guards) and corresponding `streams.observe` registrations.
- If zones used: adapt highlight computation (unit, scale bounds, colors) and remove unused scaffolding.
- Add/expand tests (mock streams, theme, optional zones metadata).

### 13.6 Zones Support Notes
If `--zonesSupport=true`:
- `WidgetMetadataDirective` is injected; you must call `metadata.observe('signalKPath')` (or other path key) only if a path is configured.
- `metadata.zones()` exposes current zones; pass through `getHighlights` with min/max scale & unit for overlays.
- Always guard: missing path OR zones → return empty highlight array.

### 13.7 Common Pitfalls & Resolutions
| Pitfall | Cause | Resolution |
|---------|-------|-----------|
| Widget not listed in Add dialog | Chose `registerWidget No` or category mismatch | Regenerate OR manually add definition to `widget.service.ts` |
| Duplicate import/service entry | Manual edits then re-run schematic | Remove redundant lines; schematic guards imports but verify component map |
| Runtime error in highlights | Accessing undefined scale or wrong path key | Guard `cfg.paths['signalKPath']` and ensure scale present before computing |
| Units not converting | Missing or null `convertUnitTo` in path config | Add target unit in path definition (number types only) |
| Tests failing after adding new paths | Spec doesn’t mock added streams | Update spec to provide minimal mock path observation |

### 13.8 Recommended Development Flow
1. Generate widget with `--todoBlock=true` for guidance.
2. Implement path observation & basic rendering logic.
3. Add zones (if required) and verify highlight behavior with test data.
4. Remove TODO comments (or regenerate clean variant) once stable.
5. Add additional paths & unit tests (timeout, no-path, zones absent).
6. Finalize icon & description, then open PR.

### 13.9 Troubleshooting Registration
If the schematic ran but the widget is missing:
1. Open `widget.service.ts` and search for your selector (e.g., `widget-tides-chart`).
2. Confirm: import line, component map entry, and definition object exist.
3. If absent, re-run with `--debugLogging=true` to inspect logs, or manually paste the generated object from another widget as a template.

### 13.10 Conventions Recap
- One effect for all observers.
- Guard optional paths before observing.
- Signals for state; avoid extraneous change detection.
- Use `untracked()` when registering observers to prevent superfluous effect retriggers.
---
