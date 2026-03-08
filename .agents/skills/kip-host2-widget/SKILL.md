---
name: kip-host2-widget
description: Apply KIP Host2 widget contract patterns for widget component changes, including runtime/options guards, stream observation structure, and transient signal state handling.
---

# KIP Host2 Widget

Use this skill when creating or modifying KIP Host2 widgets.
This skill defines implementation patterns only; policy authority remains in instruction files.

Load `.github/instructions/project.instructions.md` first, then apply this skill as the detailed implementation companion for the `Host2 Widget Contract` section.

## Use This Skill When

- Editing files under `src/app/widgets/` that implement widget behavior.
- Updating Host2 runtime/stream wiring in widget components.
- Changing widget path-driven observation behavior.

## Core Expectations

- Keep widget defaults complete in `DEFAULT_CONFIG`.
- Guard `runtime.options()` and optional path keys before observing streams.
- Register stream observations together in one effect and group observer registration in one `untracked()` block.
- Keep transient UI state in signals; do not mutate merged config objects.
- Use existing units/formatting services instead of hardcoded conversions.

## Avoid

- Reintroducing legacy base-widget inheritance patterns.
- Scattering `streams.observe(...)` registrations across multiple lifecycle locations.
- Adding widget-local logic that bypasses existing runtime/stream directives.

## References

- `.github/instructions/project.instructions.md`
- `COPILOT.md` (Host2 widget contract and architecture notes)
