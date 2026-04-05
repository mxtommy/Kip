# KIP Copilot Routing Instructions

This file defines how AI agents must route and apply instructions in this repository.
It is intentionally short. Detailed rules live in:

- `.github/instructions/best-practices.instructions.md`
- `.github/instructions/angular.instructions.md`
- `.github/instructions/project.instructions.md`
- `.github/instructions/electrical-widgets.instructions.md`

## Instruction Load Order

Always load and apply instruction files in this order:

1. `.github/instructions/best-practices.instructions.md`
2. `.github/instructions/angular.instructions.md`
3. `.github/instructions/project.instructions.md`

## Precedence Rules

- `project.instructions.md` overrides Angular guidance when KIP architecture requires it.
- `angular.instructions.md` overrides generic guidance for framework-specific behavior.
- `best-practices.instructions.md` is always in effect unless an explicit project override exists.

## Scope Separation Contract

- `best-practices.instructions.md`: Cross-cutting quality rules only (TypeScript quality, testing expectations, accessibility, documentation).
- `angular.instructions.md`: Angular framework patterns only (signals, templates, DI, routing, forms).
- `project.instructions.md`: KIP architecture and domain conventions only (Host2 widgets, Signal K data paths, dataset orchestration, base path).

Do not duplicate detailed rules across files. Reference the owning file instead.

## Instruction File Ownership Rules

Use this map whenever creating or editing instruction content:

- Put content in `best-practices.instructions.md` when it applies across frameworks and features (quality, testing posture, accessibility, documentation, change hygiene).
- Put content in `angular.instructions.md` when it is Angular API/framework behavior (signals, template control flow, DI patterns, component patterns, routing/forms/http framework usage).
- Put content in `project.instructions.md` when it is KIP-specific architecture or domain behavior (service boundaries, ownership contracts, Signal K/plugin integration constraints, Host2 policy constraints).
- Put content in `electrical-widgets.instructions.md` when it is a strict electrical-widget specialization rule derived from KIP widget architecture.
- Put content in `COPILOT.md` when it is long-form architecture context, rationale, and extended implementation reference material that should not be policy text.

If a rule could fit in multiple files, keep it in the most specific owning file and reference it from the others.

## Instruction Update Discipline

When updating instruction files:

1. Keep each rule in one owning file; do not duplicate rule text.
2. Prefer short references over repeated paragraphs.
3. Keep `copilot-instructions.md` routing/governance only.
4. Keep skills implementation-focused; instruction files stay policy-authoritative.
5. Add new rules once in the owner file and verify overlap was not introduced.
6. Treat `COPILOT.md` as supporting context, not policy authority.

Before finalizing instruction edits, run this quick check:

- `Scope check`: each new rule belongs to exactly one owning instruction file.
- `Duplication check`: no repeated rule blocks across instruction files.
- `Routing check`: skill matrix still maps task type to the right skills without adding policy text.

## Documentation Edit Workflow (Mandatory)

Use this workflow whenever editing AI documentation files (`COPILOT.md`, `.github/instructions/*.md`, `.agents/skills/*/SKILL.md`, or this file).

1. Run required preflight reads first:
  - `COPILOT.md` (`Expansion Boundaries (Anti-Drift)` section)
  - `.github/instructions/best-practices.instructions.md`
  - `.github/instructions/angular.instructions.md`
  - `.github/instructions/project.instructions.md`
  - `.github/instructions/electrical-widgets.instructions.md` when editing specialized electrical widget guidance2. Declare ownership mapping before editing:
  - which file is policy owner
  - which file is context/rationale only
  - which file is implementation companion only
3. Keep enforceable behavior in instruction files only.
4. Keep `COPILOT.md` pointer-oriented and rationale-focused; do not duplicate policy bullets there.
5. Run final self-checks before concluding edits:
  - `Ownership check`
  - `Duplication check`
  - `Drift check`

## Skill Selection Matrix

Use project skills plus Angular skills based on edit type:

- Modifying existing widgets/components (editing code, UI changes, features, styling):
  - `angular-component`
  - `angular-signals`
  - `angular-directives` (if host bindings/directives are involved)
  - `kip-host2-widget` (for Host2 widget contract work)
- Service and dependency wiring:
  - `angular-di`
  - `angular-http` (if API calls are involved)
- Forms and widget config UIs:
  - `angular-forms`
- Routing and navigation:
  - `angular-routing`
- Test creation and refactors:
  - `angular-testing`
- Build and generation workflow:
  - `angular-tooling`
- Creating new widgets (from schematic, scaffolding):
  - `angular-tooling`
  - `kip-host2-widget`
  - `kip-widget-creation`
- Dataset lifecycle, ownership cleanup, and dataset write paths:
  - `kip-dataset-orchestration`
- History series reconciliation and mapping flow changes:
  - `kip-history-series-reconcile`

For multi-concern edits, apply all matching skills and prioritize project constraints when conflicts occur.

Skills provide implementation patterns. Instruction files remain the policy source of truth.

For all work touching this repository, always apply `project.instructions.md` in addition to the relevant Angular skill(s).

For charger, inverter, alternator, AC, and future specialized electrical widgets, also apply `electrical-widgets.instructions.md`.

## Required Output Checklist For Agent Responses

When making code changes, include a short checklist in the response:

1. Instruction files applied.
2. Skills used (Angular + KIP as applicable).
3. Project-specific constraints validated.
4. Tests or validation run (or why not run).

## Required Output Checklist For Documentation Edits

When editing AI documentation files, include this checklist in the response:

1. Preflight reads completed (including `COPILOT.md` anti-drift section and instruction load order files).
2. Policy owner identified for each changed rule.
3. Context-only vs policy-authoritative file roles confirmed.
4. No duplicated policy text added to `COPILOT.md`.
5. Ownership, duplication, and drift checks completed.

## Project Anchors

- Project anchors and architecture context are maintained in `.github/instructions/project.instructions.md` and `COPILOT.md`.
