---
name: kip-widget-creation
description: Create and scaffold new KIP Host2 widgets using the widget schematic with consistent post-generation implementation, registration, tests, and documentation updates.
---

# KIP Widget Creation

Use this skill when creating a new KIP widget or formalizing widget scaffold + post-generation workflow.
This skill defines implementation patterns only; policy authority remains in instruction files.

Load `.github/instructions/project.instructions.md` first, then apply this skill as the implementation companion for `Widget Creation Domain Rules` and `Host2 Widget Contract`.

## Use This Skill When

- Creating a new widget with `npm run generate:widget`.
- Deciding between schematic-based scaffolding and manual creation.
- Updating widget registration and baseline defaults after scaffolding.
- Improving generated widget tests and README guidance.

## Core Expectations

- Prefer schematic-first creation for standard Host2 widgets.
- Keep manual creation reserved for documented non-standard wiring or utility-component cases.
- Keep `DEFAULT_CONFIG` complete and explicit (paths, units, sample time, widget options).
- Preserve Host2 runtime/stream guardrails from `.agents/skills/kip-host2-widget/SKILL.md`.
- Ensure widget registration consistency when `registerWidget` is enabled.
- Update tests beyond instantiation checks with domain assertions.
- Keep contributor and help documentation links aligned when introducing new widget patterns.

## Preconditions

Before creating or changing a widget, the agent should:

1. Load `.github/instructions/project.instructions.md` and `.agents/skills/kip-host2-widget/SKILL.md`.
2. Prefer schematic-first creation unless the task explicitly requires documented manual creation.
3. Choose the widget name, title, description, icon ID, and registration category before generating files.
4. Decide whether the widget is expected to support:
   - custom widget options
   - numeric-path history dialog behavior
   - Signal K zone state / color behavior
5. Confirm whether an existing icon ID in `src/assets/svg/icons.svg` can be reused or whether a new icon entry is required.

## Required Edits

These edits are expected for a standard new widget flow unless the task explicitly scopes them out.

1. Generate the widget scaffold:
   - `npm run generate:widget -- --name <name> --title <title> --description <description> --icon <icon> --register-widget <category-or-no>`
2. Review generated files and complete implementation in the widget folder:
   - component
   - template
   - styles
   - spec
   - README
3. Keep `DEFAULT_CONFIG` complete and explicit:
   - path keys
   - units / `convertUnitTo`
   - sample time
   - widget options when supported
4. Update widget registration when `registerWidget` is enabled:
   - ensure `widget.service.ts` uses the correct component, icon ID, description, and category
5. Add or update SVG icon support when needed:
   - add the icon entry to `src/assets/svg/icons.svg`
   - reference the icon ID from `widget.service.ts`
6. Implement Host2 runtime behavior:
   - guard runtime/path inputs
   - keep stream observation deterministic
   - use existing units / formatting helpers
   - follow runtime/options guardrails from `.agents/skills/kip-host2-widget/SKILL.md`
7. Update docs when the widget becomes user-visible:
   - widget README in the widget folder
   - help docs under `src/assets/help-docs/` when needed
   - `src/assets/help-docs/menu.json` when a new help page is added
   - widget catalog references in README.md and dashboards.md when applicable

## Conditional Branches

Apply these branches only when the widget behavior requires them.

1. If the widget has custom widget options:
   - define the options shape in the widget component/config
   - implement config UI under `src/app/widget-config/`
   - use existing validators and path config conventions
   - keep option changes reactive and compatible with Host2 runtime patterns
2. If the widget uses numeric paths and should support history:
   - confirm a series is available for the widget path using the Signal K host URL documentation or `GET /plugins/kip/series`
   - verify the history dialog opens with the correct widget series/value context
   - verify history behavior preserves deterministic series ordering
3. If the widget surfaces Signal K zones:
   - verify zone state/severity is consumed correctly
   - verify zone-driven colors align with theme roles and displayed status state
   - verify `ignoreZones` behavior if that option is supported
4. If manual creation is used instead of the schematic:
   - keep generated-file expectations equivalent to schematic output where applicable
   - manually verify registration consistency and Host2 contract adherence

## Validation Gates

Do not consider the widget work complete until the applicable gates pass.

1. Scaffold gate:
   - generated files exist in the expected widget folder
   - registration updates are present when `registerWidget` is enabled
2. Icon gate:
   - the widget uses a valid icon ID from `src/assets/svg/icons.svg`
   - the icon appears correctly in the Add Widget dialog
3. Runtime gate:
   - widget renders with valid data
   - runtime/path guards behave safely when config is incomplete
   - stream observation stays deterministic
4. Options gate, when applicable:
   - options UI renders correctly
   - option changes persist and affect widget behavior as expected
5. History gate, when applicable:
   - a matching series exists for the widget path
   - the history dialog opens and displays the correct context
6. Zones gate, when applicable:
   - zone status/state is reflected correctly
   - zone colors follow theme-role expectations
   - `ignoreZones` disables zone behavior cleanly when supported
7. Theme gate:
   - Night Mode works with and without Red-Only mode
   - High-Contrast theme remains legible and uses theme roles correctly
8. Test gate:
   - tests go beyond instantiation-only coverage
   - tests cover path/config behavior plus at least one domain behavior relevant to the widget
   - add options/history/zones/theme assertions when those features apply
9. Documentation gate:
   - widget description/category/docs stay aligned across widget registration and user-facing docs

## Stop Conditions

Stop and resolve the issue before proceeding if any of the following occur:

1. The schematic fails or does not produce the expected widget files.
2. `widget.service.ts` registration is missing, inconsistent, or points to the wrong icon/component/category.
3. The widget cannot be implemented without violating Host2 runtime/stream guardrails.
4. A numeric-history widget is expected to support history, but no matching series exists for the configured path.
5. The widget requires config UI, but the required option shape or validator behavior is still undefined.
6. Zone-aware behavior is expected, but zone state/color semantics are unclear or cannot be mapped to existing theme roles.
7. Required tests cannot be added or updated to cover the widget behavior being introduced.
8. Documentation changes would introduce duplicated ownership instead of updating the canonical reference.

## Avoid

- Treating this skill as policy authority.
- Reintroducing legacy base-widget inheritance.
- Duplicating policy text from `.github/instructions/*.md` into skill docs.
- Leaving generated tests at instantiation-only for non-trivial widget behavior.
- Adding widget creation guidance in multiple places without cross-link ownership.

## References

- `.github/instructions/project.instructions.md`
- `.agents/skills/kip-host2-widget/SKILL.md`
- `docs/widget-schematic.md`
- `COPILOT.md` (architecture context, non-policy)
