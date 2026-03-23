# Angular Instructions (Framework Only)

This file contains Angular-specific rules for this repository.
Do not place KIP business architecture or project workflow rules here.

## Version Target

- Target Angular v20+ patterns.
- Prefer APIs and syntax from the current `angular.dev` guidance.

## Core Angular Rules

- Use standalone components, directives, and pipes.
- Do not add `standalone: true` in decorators unless explicitly needed for compatibility.
- Prefer signals for local reactive state.
- Use `input()` and `output()` functions instead of decorator-based inputs and outputs.
- Use `computed()` for derived values.
- Use `effect()` for side effects, and keep effects narrow and deterministic.
- Prefer `inject()` over constructor injection unless constructor injection is clearer.
- Use `ChangeDetectionStrategy.OnPush` for components unless there is a documented reason not to.
- This repository runs zoneless; do not add `zone.js` back into app runtime/build configuration.
- Prefer signal/event-driven updates over `NgZone.run(...)` or `NgZone.runOutsideAngular(...)`; only use `NgZone` for documented compatibility edge cases.

## Template Rules

- Prefer native control flow (`@if`, `@for`, `@switch`) over structural directives for common flow.
- Keep templates declarative; move complex logic to TypeScript.
- Do not use arrow functions directly in templates.
- Avoid non-deterministic expressions in templates (`new Date()`, `Math.random()`, ad hoc object allocation).
- Prefer class/style bindings over `ngClass` and `ngStyle` when practical.
- Use `async` pipe when binding observables in templates.

## Component Rules

- Keep components focused on one responsibility.
- Use small presentational components when a template becomes hard to reason about.
- Use `host` metadata for host bindings/listeners instead of `@HostBinding` and `@HostListener`.
- Use external HTML/SCSS files for medium/large components; inline is acceptable for very small components.

## State And Data Flow

- Keep state transitions explicit with `set()` and `update()`.
- Do not use `mutate()` on signals.
- Keep derived state in `computed()` instead of recalculating in templates.
- Use pure mapping/transform logic where possible.

## Signals And Observables Migration

- Keep Observables for transport and stream boundaries (for example HTTP, websocket/event feeds, and shared async pipelines).
- Prefer signals for local view state and derived UI state consumed directly by templates.
- Migrate incrementally: convert component-facing Observable state to signals first; keep service transport APIs stable unless there is clear benefit.
- Use interop helpers (for example `toSignal`) at the boundary layer, not deep inside templates.
- Avoid dual writable sources of truth. Choose one primary state owner and derive the other representation from it.
- Do not replace mature RxJS pipelines that already model complex async behavior correctly unless there is a measurable maintainability or performance gain.
- Keep side effects explicit and deterministic when bridging streams and signals.

## Forms, Routing, HTTP

- Prefer reactive forms for non-trivial forms.
- Use lazy loading for feature routes.
- Use functional guards/resolvers where they improve readability.
- Keep HTTP access in services, not directly in components.

## Images And Performance

- Use `NgOptimizedImage` for static image rendering when possible.
- Avoid unnecessary re-renders by stabilizing object/array references used in bindings.

## Accessibility Baseline

- Meet WCAG AA minimums for semantics, keyboard navigation, focus behavior, and contrast.
- Keep ARIA attributes accurate and minimal.

## Official References

- https://angular.dev/style-guide
- https://angular.dev/guide/signals
- https://angular.dev/guide/templates
- https://angular.dev/guide/components
- https://angular.dev/guide/di
