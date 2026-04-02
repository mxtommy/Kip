# Electrical Widget Specialization Instructions

This file defines strict KIP rules for electrical family widgets that specialize Host2 widget behavior for:
- chargers
- inverters
- alternators
- AC
- future non-BMS, non-solar electrical widgets

These rules are project-specific architecture rules.
Use `widget-bms` and `widget-solar-charger` as the reference implementations for runtime structure and rendering discipline.

## Scope

- This file applies when creating or refactoring specialized electrical widgets.
- It does not replace `.github/instructions/project.instructions.md`; it narrows project rules for this widget family.
- It does not apply to plugin contract files unless a widget contract change requires it.

## Architecture Reference

- Treat `widget-bms` and `widget-solar-charger` as the architectural reference widgets.
- Do not use `widget-electrical-family` as the UI architecture template for new electrical widgets.
- A shared runtime helper is allowed, but each electrical widget must keep its own specialized component, template, styles, types, and tests.

## Required Specialization Rules

- Each electrical widget must have its own:
  - component class
  - HTML template
  - SCSS file
  - `*.types.ts` file
  - component spec
- Do not route new electrical widgets through a shared electrical-family rendering component.
- Reuse project services, contracts, and descriptor metadata, but keep visual rendering per family.

## Required Runtime Structure

- Keep one explicit `DEFAULT_CONFIG` for the widget.
- Add one dedicated `resolve<Family>Config()` method that normalizes:
  - `trackedIds`
  - `groups`
  - `options`
  - `cardMode`
- Keep signal state layered in this order:
  - discovered ids
  - tracked ids
  - raw snapshot map
  - visible ids
  - visible units
  - widget colors
  - display models
- Use a strict `parsePath()` plus `applyValue()` pair.
- Keep `applyValue()` explicit; do not use ad hoc key-to-property mutation tables without clear typing.

## Path And Subscription Rules

- Path registration may use the electrical family descriptor as the source of truth for the root path.
- Path parsing must follow the BMS/Solar discipline unless a documented family-specific exception exists.
- Do not add permissive parsing fallbacks unless the upstream Signal K shape requires them and the exception is covered by tests.
- Treat wildcard subscription updates deterministically:
  - flush initial snapshot set immediately
  - debounce live updates with the same batching window used by BMS and Solar

## Snapshot And Display Model Rules

- Raw snapshot types must extend `IElectricalTopologySnapshotCore` when applicable.
- Keep per-metric state fields where the data supports them.
- Do not collapse all severity/state into one raw snapshot field.
- Derive aggregate visual state in the display-model layer, not in the raw snapshot layer.
- Do not render directly from raw snapshot maps.
- Rendering must consume computed display models.

## Rendering Rules

- Keep D3/SVG rendering family-specific.
- Keep render scheduling separate from render implementation.
- Effects that trigger rendering must read signal dependencies before early-return guards such as missing SVG refs.
- Use theme roles and existing widget color helpers; do not hardcode TypeScript colors.
- Card mode behavior must be implemented through the shared card-mode contract, not through ad hoc widget-only flags.

## Grouping And Card Mode Rules

- If a widget config exposes `groups`, runtime behavior must make an intentional choice:
  - use groups in rendering/selection logic, or
  - treat groups as config-only for now and document/test that behavior
- Do not leave groups half-wired.
- Support the shared card-mode contract fields:
  - `enabled`
  - `displayMode`
  - `metrics`

## Anti-Drift Rules

- Do not copy the shared `widget-electrical-family` rendering pattern into new specialized widgets.
- Do not skip the display-model layer.
- Do not render directly from raw snapshots.
- Do not reintroduce legacy tracked-id config fields.
- Do not introduce widget-specific contract drift when a shared electrical contract already exists.
- Keep charger aligned with BMS/Solar and use charger only as a reference after it preserves all rules in this file.

## Test Requirements

- Each specialized electrical widget must test:
  - path subscription root
  - initial flush behavior
  - live batching behavior
  - tracked-id filtering
  - display-model derivation
  - render activation when data arrives after SVG init
  - card-mode behavior
- If the widget introduces family-specific parsing or rendering rules, add direct regression tests for them.

## Reuse Guidance

- Reuse from BMS and Solar Charger:
  - runtime layering
  - config normalization discipline
  - render scheduling discipline
  - state aggregation discipline
- Reuse from Charger only when it still conforms to this file.
- For inverter, alternator, and AC, use this file plus the BMS/Solar reference implementation before copying any widget code.
