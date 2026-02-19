# KIP – Copilot Architecture & Guardrails

This is the root entrypoint for AI/developer guidance.

Canonical instructions live in:
- `.github/copilot-instructions.md` (KIP-specific implementation rules)
- `.github/instructions/angular.instructions.md` (Angular framework standards)
- `.github/instructions/project.instructions.md` (long-form project notes)

## Final Architecture (2026 Q1)
- **Historical-series orchestration:** `DashboardService` → `HistorySeriesReconcileService` → `KipSeriesService` → plugin `/plugins/kip/series/reconcile`.
- **Dataset lifecycle ownership:** `WidgetDatasetLifecycleService` is the single write-owner for dataset create/edit/remove and owner-based cleanup.
- **Shared history mapping:** `HistoryChartAdapterService` performs history-values → chart datapoint adaptation; `DatasetService` delegates to it.
- **Delete cleanup behavior:** Owner UUID matching (`ownerUuid` and `ownerUuid-*`) is the standard cleanup contract.

## Architecture Guardrails for Contributors
1. Use lifecycle sync helpers for chart/trend widgets (`syncDataChartDataset`, `syncNumericMiniChartDataset`, `syncWindTrendsDatasets`).
2. Keep widget UUID ownership stable and unique.
3. Route history-response mapping changes through `HistoryChartAdapterService` only.
4. Do not reintroduce selector-specific dataset cleanup branches.

## Contributor Notes
- Use `npm run dev` for local development and verify base path `/@mxtommy/kip/`.
- Run `npm run lint` and relevant tests before submitting changes.
- Keep Host2 widget patterns and architecture guardrails aligned with `.github/copilot-instructions.md`.
