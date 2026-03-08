---
name: kip-dataset-orchestration
description: Apply KIP dataset ownership and lifecycle rules for widget and dashboard flows, including centralized write paths and owner UUID cleanup behavior.
---

# KIP Dataset Orchestration

Use this skill when changing dataset creation, update, or cleanup behavior.
This skill defines implementation patterns only; policy authority remains in instruction files.

## Use This Skill When

- Editing dataset lifecycle behavior in dashboard/widget flows.
- Touching dataset ownership cleanup logic.
- Refactoring direct dataset writes toward orchestrated paths.

## Core Expectations

- Treat `WidgetDatasetOrchestratorService` as the write-owner for widget/dash dataset lifecycle operations.
- Preserve stable widget UUID ownership semantics used for cleanup and reconciliation.
- Keep cleanup behavior owner-UUID based; do not reintroduce selector-specific cleanup branches.
- Keep dataset lifecycle changes aligned with project service boundaries.

## Avoid

- Direct widget/dashboard dataset create/edit/remove flows that bypass orchestration helpers.
- Partial ownership models that break cleanup determinism.
- Duplicating lifecycle logic in multiple services/components.

## References

- `.github/instructions/project.instructions.md`
- `COPILOT.md` (dataset lifecycle and finalized architecture notes)
