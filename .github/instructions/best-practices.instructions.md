# Cross-Cutting Best Practices

This file defines non-framework, cross-cutting quality rules that apply to all code in this repository.
Angular-specific patterns belong in `.github/instructions/angular.instructions.md`.
KIP architecture rules belong in `.github/instructions/project.instructions.md`.

## TypeScript Quality

- Keep strict typing. Do not weaken TypeScript config to bypass errors.
- Prefer explicit domain types over ad hoc inline shapes.
- Avoid `any`; use `unknown` and narrow with type guards.
- Prefer immutable patterns for shared data structures.
- Keep function signatures small and focused.

## Readability And Maintainability

- Write cohesive units with single responsibility.
- Use descriptive names that communicate intent.
- Extract repeated logic into utilities/services.
- Keep files organized and avoid unrelated changes in one edit.
- Add brief comments only where intent is non-obvious.

## Testing Expectations

- Add or update tests when behavior changes.
- Prioritize tests for critical flows, edge cases, and regressions.
- Keep tests deterministic and avoid hidden timing dependencies.
- Do not rely on implementation details when observable behavior can be asserted.

## Accessibility Requirements

- Meet WCAG AA minimum expectations.
- Ensure keyboard access and visible focus states.
- Keep semantic structure and labels accurate.
- Validate color contrast for interactive and informational UI.

## Performance Baseline

- Avoid unnecessary allocations in hot paths.
- Minimize repeated heavy computations; cache or precompute where appropriate.
- Avoid large synchronous work on the main thread during interaction-heavy flows.

## Documentation Standards

- Document non-trivial public APIs and business rules.
- Public APIs and non-trivial public TypeScript properties/methods should include full JSDoc with:
  - purpose
  - parameters
  - return value
  - at least one usage example
  - Methods that implement framework lifecycle interfaces or match Angular lifecycle hook signatures are exempt when behavior is self-explanatory.
  - Host2 widget boilerplate members are exempt when declarations are  self-explanatory and standardized across widgets.

## Change Hygiene

- Keep diffs scoped to the task.
- Preserve backward compatibility unless a change is explicitly breaking.
- If a breaking change is unavoidable, call it out clearly in the response.
