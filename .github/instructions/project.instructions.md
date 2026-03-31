# KIP Project Instructions (Project Only)

This file defines KIP-specific architecture and domain rules.
Do not place generic Angular framework style rules here.

## Project Anchors

- App base path: `/@mxtommy/kip/`.
- Primary runtime data flow:
  `SignalKConnectionService` -> `SignalKDeltaService` -> `DataService` -> widgets.
- Canonical architecture reference: `COPILOT.md`.

## Core Architecture (2026 Q1)

- History series reconciliation pipeline:
  `DashboardService` -> `DashboardHistorySeriesSyncService` -> `KipSeriesApiClientService` -> plugin reconcile endpoint.
- Dataset lifecycle write ownership is centralized in `WidgetDatasetOrchestratorService`.
- History response to chart datapoint mapping is centralized in `HistoryToChartMapperService`.
- Delete-path cleanup is owner UUID based; do not reintroduce selector-specific cleanup branches.

## Required Guardrails

- Do not write dataset create/edit/remove directly from widget or dashboard flows; use `WidgetDatasetOrchestratorService` helpers.
- Keep widget UUID ownership stable. Ownership drives dataset cleanup and series reconciliation.
- Route history mapping changes through `HistoryToChartMapperService` only.
- Preserve existing plugin reconciliation behavior and endpoint contract.

## Widget History Dialog Contract

- Treat widget history dialog flows as read-only history consumers; do not add dataset create/edit/remove behavior in dialog code paths.
- Keep wildcard/template expansion behavior deterministic so repeated loads preserve stable dataset ordering.
- Keep reconcile payload ownership in dashboard sync + API client services; do not move reconcile orchestration into dialog components.
- Dual-axis widget history behavior must preserve explicit metric-to-axis mapping contracts and stay test-covered.
- Dual-axis visual semantics must stay deterministic and test-covered:
  - metric determines color mapping
  - series order determines solid/dashed stroke style
  - line, legend, and tooltip stroke styles remain aligned
- Keep axis title coloring aligned to the axis metric color it represents.
- Fallback behavior for unresolved/wildcard paths must remain explicit and test-covered.

## Host2 Widget Contract

- Follow Host2 architecture for widgets; do not reintroduce legacy base-widget inheritance patterns.
- Keep Host2 policy constraints enforced (guard runtime/path inputs, preserve signal-based transient state, and keep stream wiring structured and deterministic).
- Respect existing timeout, units, and runtime/stream directive contracts.

Detailed Host2 implementation patterns are owned by `.agents/skills/kip-host2-widget/SKILL.md`.

## Widget Creation Domain Rules

- Prefer the Host2 widget schematic (`npm run generate:widget`) for new widget scaffolding unless a documented manual exception applies.
- Manual widget creation is allowed for non-standard runtime/stream wiring, but it must still conform to Host2 contract constraints.
- New widgets must keep `DEFAULT_CONFIG` complete and explicit, including path keys, sampling, and units expectations.
- If widget registration is performed manually, registration map and definition entries must remain consistent with category conventions.
- Widget creation changes must include test updates appropriate to the widget behavior, not only instantiation checks.

Detailed implementation patterns are owned by `.agents/skills/kip-widget-creation/SKILL.md`.

## Widget Config Domain Rules

- Widget configuration UI belongs under `src/app/widget-config/`.
- Use project validators and path config conventions.
- Respect `isPathConfigurable` and `pathRequired` semantics.
- New widget config UI is needed only when introducing new config properties or custom UX.

## Theme And Color Rules

- Use KIP theme roles and CSS variables for all widget and app coloring.
- Do not hardcode color hex values in widget TypeScript or SCSS.
- Ensure state-based colors map to existing theme roles (alarm/warn/normal).

## Plugin And API Boundaries

- Keep plugin configuration interactions within plugin config client/service boundaries.
- Avoid adding install/uninstall plugin behavior unless explicitly required.
- Preserve current API contracts with Signal K and plugin endpoints.

## When adding new types, choose the owner by usage:

- If the type is primarily used to build or consume KIP widget config forms/runtime internals, place it in `interfaces`.
- If the type is shared across package/runtime boundaries (app/plugin) or is a stable external contract, place it in `contracts`.

## Build And Runtime Constraints

- Preserve base path behavior for dev and build output.
- Avoid introducing new CommonJS dependencies unless intentionally allowed in build config.

## Project Service Anchors

When making architecture decisions, prioritize these services and their responsibilities:

- `SignalKConnectionService`
- `SignalKDeltaService`
- `DataService`
- `WidgetDatasetOrchestratorService`
- `HistoryToChartMapperService`
- `DashboardHistorySeriesSyncService`
- `KipSeriesApiClientService`
- `PluginConfigClientService`


### Type Ownership Rules (Do Not Drift)

KIP intentionally keeps both `interfaces` and `contracts` folders. Do not merge them.

- **`src/app/core/interfaces` is the normalized app/widget typing hub**
   - Keep widget-config form model types centralized in `widgets-interface.ts`.
   - This is where widget setup/runtime normalized config objects are defined for fast widget creation.
- **`src/app/core/contracts` is for cross-boundary contracts**
   - Keep stable schemas used across features or packages here.
   - `kip-series-contract.ts` is shared with the plugin and must remain a boundary contract.

## Cross-Reference

- Use `.github/instructions/angular.instructions.md` for framework-level implementation patterns.
- Use `.github/instructions/best-practices.instructions.md` for cross-cutting quality standards.
