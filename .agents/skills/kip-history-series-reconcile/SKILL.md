---
name: kip-history-series-reconcile
description: Apply KIP history-series reconciliation and mapping constraints across dashboard and chart/history flows.
---

# KIP History Series Reconcile

Use this skill when changing history-series reconciliation or history-to-chart mapping behavior.
This skill defines implementation patterns only; policy authority remains in instruction files.

## Use This Skill When

- Editing `DashboardHistorySeriesSyncService` reconciliation behavior.
- Editing `KipSeriesApiClientService` integration behavior for reconciliation.
- Editing history values to chart datapoint conversion.

## Core Expectations

- Preserve the reconciliation pipeline: dashboard state -> sync service -> API client -> plugin reconcile endpoint.
- Route history response mapping behavior through `HistoryToChartMapperService`.
- Keep plugin contract assumptions stable unless a deliberate API change is coordinated.
- Keep reconciliation and mapping concerns separated.

## Widget History Dialog Enhancements (Implementation Companion)

Use this checklist when changing widget history dialog behavior that affects historical series display.

- Keep dialog code as a read-only history consumer; do not add reconcile orchestration to dialog components.
- Keep template/wildcard expansion deterministic and stable across repeated renders.
- Keep dual-axis behavior centralized in shared helpers (classification, ordering, style, and axis config).
- Keep line/legend/tooltip stroke semantics sourced from the same dataset style logic.
- Keep axis title coloring mapped to the corresponding axis metric color.

### Suggested Regression Test Matrix

- Metric-to-axis mapping assertions for each supported dual-axis widget type.
- Deterministic series order assertions after wildcard/template expansion.
- Metric-color mapping assertions across multiple entities.
- Series-order stroke style assertions across multiple entities (solid/dashed behavior).
- Legend stroke style parity assertions against dataset stroke styles.
- Tooltip stroke style parity assertions against dataset stroke styles.
- Fallback behavior assertions when concrete paths are unavailable.

## Avoid

- Implementing ad hoc history mapping in chart consumers.
- Bypassing sync service orchestration for reconciliation state.
- Silent contract drift in reconcile payload structure.

## References

- `.github/instructions/project.instructions.md`
- `COPILOT.md` (history-series and mapping architecture)
