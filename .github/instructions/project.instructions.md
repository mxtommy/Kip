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

## Host2 Widget Contract

- Follow Host2 architecture for widgets; do not reintroduce legacy base-widget inheritance patterns.
- Keep Host2 policy constraints enforced (guard runtime/path inputs, preserve signal-based transient state, and keep stream wiring structured and deterministic).
- Respect existing timeout, units, and runtime/stream directive contracts.

Detailed Host2 implementation patterns are owned by `.agents/skills/kip-host2-widget/SKILL.md`.

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

## Cross-Reference

- Use `.github/instructions/angular.instructions.md` for framework-level implementation patterns.
- Use `.github/instructions/best-practices.instructions.md` for cross-cutting quality standards.
