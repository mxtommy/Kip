# Electrical Widget Specialization Instructions

This file defines strict KIP rules for specialized electrical Host2 widgets for:
- chargers
- inverters
- alternators
- AC
- Solar Charger
- BMS
- future electrical widgets

These are project-specific architecture rules.
Use widget-bms and widget-solar-charger as the architectural reference widgets for runtime structure, render scheduling, and display-model discipline.

## Scope

- This file applies when creating or refactoring specialized electrical widgets.
- It narrows project rules from `.github/instructions/project.instructions.md` for this widget family.
- It does not apply to plugin contract files unless a widget contract change requires it.
- It is the policy owner for specialized electrical widget behavior. Keep rationale and long-form examples out of this file.

## Architecture Reference

- Treat widget-bms and widget-solar-charger as the runtime reference implementations.
- Treat the removed legacy widget-electrical-family path as retired architecture; do not reintroduce it.
- Do not route new electrical widgets through a shared electrical-family rendering component.
- Shared helpers are allowed only when they do not erase family-specific runtime, rendering, or test coverage.

## Required Specialization Rules

- Each electrical widget must keep its own:
  - component class
  - HTML template
  - SCSS file
  - types file
  - component spec
- Reuse project services, descriptor metadata, and shared card-layout constants where appropriate, but keep rendering and parsing family-specific.
- Do not collapse family behavior into a generic electrical renderer.

## Required Config Contract

- Use the shared electrical config contract from `src/app/core/interfaces/widgets-interface.ts`.
- Use the shared electrical card-mode contract from `src/app/core/contracts/electrical-topology-card.contract.ts`.
- Use trackedDevices as the normalized selection field for specialized electrical widgets.
- A tracked device is the composite identity:
  - id
  - source
  - key
- Do not reintroduce trackedIds, solarOptionsById, alternatorOptionsById, or other legacy config aliases in new widget code.
- Do not reintroduce `cardMode.enabled` in new widget code or tests.
- Keep one explicit DEFAULT_CONFIG per widget.
- Keep one dedicated resolve<Family>Config() method per widget that normalizes:
  - trackedDevices
  - optionsById
  - cardMode
  - groups only when the family intentionally supports groups at runtime

## Required Runtime Structure

- Keep signal state explicit and layered.
- For source-aware electrical families, the preferred order is:
  - discovered ids
  - tracked devices
  - raw snapshot map
  - visible keys
  - visible units
  - widget colors
  - display models
- For BMS-like exceptions that render by logical battery id rather than source-qualified device identity, keep the same discipline adapted to the family shape.
- Use a strict parsePath() plus applyValue() pair.
- Keep applyValue() explicit and typed; do not use loose property mutation tables.
- Keep raw snapshot maps keyed by deviceKey when source-qualified tracking is active.
- If initial data arrives before config normalization, reproject plain id snapshots into deviceKey entries once trackedDevices is known.
- Keep host `renderMode` input precedence explicit: host render mode may override widget config `cardMode.displayMode`, with widget config remaining the fallback.
- Rendering must consume visible units plus display models, never the raw snapshot map directly.

## Source-Aware Identity Rules

- Chargers, inverters, alternators, and AC are source-aware families.
- Source-aware widgets must preserve source and deviceKey in runtime snapshot/display-model flow when duplicate ids can exist across sources.
- When the same id exists across multiple sources, rendering must materialize distinct cards keyed by deviceKey.
- When duplicate ids are rendered, display metadata may use source labeling to disambiguate cards.
- Do not collapse multiple sources for the same id into one rendered unit unless the family contract explicitly requires aggregation.

## Path And Subscription Rules

- Use the electrical family descriptor as the only root-path authority for specialized electrical widgets.
- Enforce strict self-root parsing and subscription for the active family root path.
- Do not add permissive non-self parsing fallbacks.
- Legacy singular-root parsing/subscription is not allowed by default.
- A temporary legacy-path exception is allowed only when an upstream production contract requires it and all of the following are true:
- the exception is explicitly documented in the widget file as temporary compatibility behavior
- path-family rejection remains explicit
- regression tests directly cover accepted legacy paths and rejected non-family paths
- a removal condition is documented
- Wildcard updates must remain deterministic:
- flush the full initial snapshot set immediately
- debounce live updates using the shared electrical batching window used by BMS and Solar
- Source-qualified families must preserve device identity deterministically through parse, snapshot, visible key, and display-model joins.
- Source-aware identity behavior applies to charger, inverter, alternator, AC, and solar charger.
- BMS remains a logical-battery-id exception and must keep strict battery-id-based joins.
- Solar charger uses a positional id contract:
  - `self.electrical.solar.<id>`: `<id>` is discoverable in setup.
  - `self.electrical.solar.<id>.<metric...>`: `<id>` is runtime device id and `<metric...>` is the metric key.
  - Any token in `<id>` position is treated as an id (for example `power`, `charge`, `controller`, `load`).
  - Runtime value parsing must reject root-only `self.electrical.solar.<id>` paths because metric segments are required for value application.
  - Setup discovery may include root-only paths; setup discovery must not be used as a runtime parser gate.


## Snapshot And Display Model Rules

- Raw snapshot types must extend IElectricalTopologySnapshotCore when applicable.
- Preserve per-metric state fields when source data supports them.
- Do not collapse all severity into one raw state field.
- Derive aggregate visual severity in the display-model layer.
- Keep display-model keys aligned to deviceKey or id, matching the render join key.
- Do not render directly from raw snapshots.

## Rendering Rules

- Keep render scheduling separate from render implementation.
- Render only from visible units plus display models; never render from raw snapshot maps.
- Rendering effects must read all required signal dependencies before early-return guards.
- Use shared electrical layout constants for direct-card geometry and spacing.
- Use shared electrical topology card contracts for display-mode typing and snapshot core alignment.
- Use shared widget config contracts for trackedDevices, optionsById, groups, and cardMode shape.
- Card mode metrics are display-only controls; they do not define or alter history-series ownership, reconcile payload ownership, dataset lifecycle ownership, or history mapping ownership.
- Use theme roles and widget color helpers; do not hardcode TypeScript or SCSS colors.
- Host renderMode input may override config cardMode displayMode; config displayMode is fallback.
- Compact-mode behavior must be deterministic and test-covered.
- If compact mode intentionally reuses full geometry, document it as an intentional family-specific exception and keep it test-covered.

## History Capture And Chart Display Boundaries

- Specialized electrical widget history-series capture is owned by dashboard sync + KIP series API orchestration; do not move capture/reconcile orchestration into widget components or chart dialog code paths.
- Use the electrical family descriptor contract as the source of truth for history template roots and expansion mode selection for electrical families.
- Treat the electrical history chart contract as chart-display semantics only:
  - metric-to-axis mapping
  - dual-axis metric order
  - path-to-metric classification
- Dual-axis chart semantics apply to BMS (ySoc/yCurrent), Solar Charger (yPower/yCurrent), Charger/Inverter/Alternator (yVoltage/yCurrent), and AC (yVoltage/yCurrent/yFrequency). Expanding to additional widget types requires contract + dialog + regression test updates together.
- Extending dual-axis behavior does not, by itself, change capture templates, series ownership, dataset lifecycle ownership, or reconcile payload ownership.
- Widget history dialog flows remain read-only history consumers for electrical widgets.


## Card Mode Rules

- Card mode uses:
  - displayMode
  - metrics
- Supported display modes are full and compact.
- Do not require or reintroduce cardMode.enabled.
- Compact-mode behavior must be deterministic and test-covered.
- If a family temporarily reuses full-card geometry while compact mode is wired, document that as an intentional family-specific exception and keep it test-covered.

## Grouping Rules

- If a family exposes groups in config, runtime behavior must make an intentional choice:
  - use groups in rendering or selection logic, or
  - treat groups as config-only for now and document and test that behavior
- Do not leave groups half-wired.
- Do not normalize groups in runtime code for families that do not intentionally support them.
- If setup UI exposes groups before runtime consumption exists, that temporary contract must be explicit and regression-tested.

## Config UI Rules

- Specialized electrical widget setup UIs must use trackedDevices controls, not trackedIds controls.
- Source-aware family setup UIs must discover source-qualified tracked devices from DataService path cache source maps when available.
- Source-aware family setup UIs must refresh discovered tracked device options when the same discovered path gains additional sources.
- Setup controls must normalize tracked device values to id/source/key entries.
- Setup UIs must preserve compareWith behavior for tracked device object selection.
- If a setup UI limits option editing to selected tracked devices, that behavior must be intentional and test-covered.

## Anti-Drift Rules

- Do not reintroduce widget-electrical-family.
- Do not copy retired shared-widget rendering patterns into specialized widgets.
- Do not skip the display-model layer.
- Do not render directly from raw snapshots.
- Do not reintroduce trackedIds or other legacy electrical config aliases.
- Do not reintroduce `cardMode.enabled` or `card` as a displayMode value.
- Do not introduce widget-specific contract drift when a shared electrical contract already exists.
- Keep specialized electrical widgets aligned to the current shared contracts first, not to older widget implementations.

## Test Requirements

- Each specialized electrical widget must test:
  - path subscription root
  - initial flush behavior
  - live batching behavior
  - trackedDevices filtering
  - fallback to all discovered units when trackedDevices is empty or cleared
  - display-model derivation
  - render activation when data arrives after SVG init
  - card-mode behavior
  - host renderMode precedence over config displayMode
- Source-aware families must also test:
  - same-id multi-source materialization into distinct deviceKey-backed cards
  - source-aware display-model labeling when duplicate ids are shown
  - deviceKey reprojection when config arrives after initial data
- Source-aware setup UIs must also test:
  - discovered tracked-device refresh when an existing path gains an additional source
  - tracked-device normalization to stable id/source/key values on reopen or submit
- If a family keeps legacy path exceptions, non-self rejection, reserved aggregate ids, or family-specific parsing behavior, those rules must have direct regression tests.

## Reuse Guidance

- Reuse from BMS and Solar Charger as first preference for:
- runtime layering discipline
- config normalization discipline
- render scheduling discipline
- state aggregation discipline
- shared-card contract usage
- Use Charger as a secondary reference only when it conforms to this file.
- For inverter, alternator, and AC, prioritize BMS and Solar discipline plus shared electrical contracts before copying charger code.
- Shared helpers are allowed only when they do not erase family-specific runtime behavior, rendering behavior, or test coverage.
- Do not reintroduce shared-family renderer patterns that bypass family-specific parse/apply/display-model behavior.
