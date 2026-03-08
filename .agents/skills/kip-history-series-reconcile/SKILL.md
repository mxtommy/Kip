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

## Avoid

- Implementing ad hoc history mapping in chart consumers.
- Bypassing sync service orchestration for reconciliation state.
- Silent contract drift in reconcile payload structure.

## References

- `.github/instructions/project.instructions.md`
- `COPILOT.md` (history-series and mapping architecture)
