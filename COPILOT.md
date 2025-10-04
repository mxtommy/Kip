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

## 9. Widget Structure, BaseWidgetComponent, and Signal K Zones
- All widgets must extend `BaseWidgetComponent` to inherit core data, config, and lifecycle logic.
  - Handles:
    - Data subscriptions via `DataService` (values and metadata).
    - Unit conversion via `UnitsService`.
    - Theme and app-wide utilities via `AppService`.
    - Config validation and merging with defaults.
    - Utility for formatting numbers with min/max and decimals.
    - Abstract methods: `startWidget()` and `updateConfig(config)` must be implemented by each widget.
  - Provides:
    - `observeDataStream()` for subscribing to live data.
    - `unsubscribeDataStream()` and `unsubscribeMetaStream()` for cleanup (call in `ngOnDestroy`).
    - `formatWidgetNumberValue()` for consistent value formatting.
    - `validateConfig()` to merge user config with defaults and prevent breaking changes.
    - `zones$` observable for zone metadata (e.g., to highlight elements in widgets based on data state ie. zone state).

  - Zones are a Signal K metadata concept that define value ranges for states like nominal, warning, alarm, and emergency.
  - The `observeMetaStream()` method in `BaseWidgetComponent` subscribes to zones metadata for a widget's data path, making it available via the `zones$` observable.

- **Widget Path Configuration:**
  - `isPathConfigurable` and `pathRequired` in `IWidgetPath` control UI and validation.
  - If `pathRequired` is `true` or undefined, path is required and must be valid.
  - If `pathRequired` is `false`, path is optional (can be empty or valid).
  - Non-configurable paths are excluded from config UI and validation.
- **Custom Validators:**
  - Path controls use a custom validator to enforce the above rules.
  - No `Validators.required` is used for path controls; only the custom validator.
- **UI Feedback:**
  - The UI uses Angular’s `@if` syntax to show “(optional)” and hints when appropriate.
  - Error messages are shown for required and invalid paths.
**Signal K Metadata, Units & Value Conversion:**
  - Signal K defines a schema with base SI units for all standard paths (e.g., meters, Celsius, Pascals). Plugins can add custom paths, but these are not in the schema and must provide their own metadata (especially units) or the path will be treated as unitless.
  - Each data path may provide metadata such as units, display names, min/max, etc. This metadata is essential for context-aware UI, validation, and display hints.
  - KIP uses the base SI units from metadata to map each path to a conversion group in the UnitsService. This enables conversion from the base SI unit to any supported display unit (e.g., meters to feet, Celsius to Fahrenheit) according to user preferences.
  - The "Format" setting in KIP determines what display format or unit to apply to a value. If no metadata units are present, the value is treated as unitless and any format (or none) can be applied.
  - The DataService provides access to both values and metadata for each path, supporting both value display and context-aware logic.

- **Widget Structure:**
  - Each widget is an Angular component in `src/app/widgets/`, extending `BaseWidgetComponent`.
  - Widget configuration is defined in `widgetProperties` (implements `IWidget`), with all config stored in `widgetProperties.config`.
  - Widget config includes paths, display options, min/max, decimals, and more.
  - All widget configuration logic/UI is handled in `src/app/widget-config/`.

- **Widget Creation Best Practices:**
  - Always extend `BaseWidgetComponent` for new widgets.
  - Implement `startWidget()` to initialize widget-specific logic.
  - Implement `updateConfig(config)` to handle config changes.
  - Use `observeDataStream()` to subscribe to data, and `observeMetaStream()` for zones/metadata.
  - Use `UnitsService` for all value conversions and formatting.
  - Store all widget state/config in `widgetProperties.config`.
  - Clean up all subscriptions in `ngOnDestroy` using provided methods.
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
- For widget development, prioritize the BaseWidgetComponent patterns described in this file
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

