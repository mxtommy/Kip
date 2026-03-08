# KIP – Copilot Architecture & Guardrails

This is the root entrypoint for AI/developer guidance.

Authoritative policy instructions live in:
- `.github/copilot-instructions.md` (routing, precedence, and instruction governance)
- `.github/instructions/best-practices.instructions.md` (cross-cutting quality policy)
- `.github/instructions/angular.instructions.md` (Angular framework policy)
- `.github/instructions/project.instructions.md` (KIP project policy)

This `COPILOT.md` file provides long-form architecture context, examples, and rationale.
If any policy wording conflicts with instruction files, follow instruction files.

## Expansion Boundaries (Anti-Drift)

Use this file for context and rationale, not policy ownership.

- Keep enforceable rules in instruction files under `.github/instructions/`.
- Do not duplicate policy bullets from instruction files; link to the owning file instead.
- Add architecture explanations, decision rationale, and extended examples here.
- If adding new guidance, first decide ownership in `.github/copilot-instructions.md` and then reference that owner here.
- Keep core architecture anchors stable; append new context in dated subsections (for example `## Architecture Notes (YYYY QN)`) instead of rewriting baseline bullets.

Before merging updates to this file:

1. `Duplication check`: no copied rule blocks from instruction files.
2. `Ownership check`: each new rule-like statement points to its policy owner.
3. `Drift check`: architecture descriptions still match `project.instructions.md` and routed skills.

## Final Architecture (2026 Q1)
- **Historical-series orchestration:** `DashboardService` → `DashboardHistorySeriesSyncService` → `KipSeriesApiClientService` → plugin `/plugins/kip/series/reconcile`.
- **Dataset lifecycle ownership:** `WidgetDatasetOrchestratorService` is the single write-owner for dataset create/edit/remove and owner-based cleanup.
- **Shared history mapping:** `HistoryToChartMapperService` performs history-values → chart datapoint adaptation; `DatasetStreamService` delegates to it.
- **Delete cleanup behavior:** Owner UUID matching (`ownerUuid` and `ownerUuid-*`) is the standard cleanup contract.

## Architecture Guardrails for Contributors
1. Use lifecycle sync helpers for chart/trend widgets (`syncDataChartDataset`, `syncNumericMiniChartDataset`, `syncWindTrendsDatasets`).
2. Keep widget UUID ownership stable and unique.
3. Route history-response mapping changes through `HistoryToChartMapperService` only.
4. Do not reintroduce selector-specific dataset cleanup branches.

## Contributor Notes
- Use `npm run dev` for local development and verify base path `/@mxtommy/kip/`.
- Run `ng lint` before submitting changes.
- Run `npm run test:all` before submitting changes.
- Keep Host2 widget patterns and architecture guardrails aligned with `.github/instructions/project.instructions.md` and routed skills from `.github/copilot-instructions.md`.
