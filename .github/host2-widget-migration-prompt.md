# Host2 Widget Migration (Concise AI Prompt)

Purpose: Migrate any legacy widget (extends `BaseWidgetComponent` + `<widget-host>`) to Host2 (runtime + streams (+ metadata when needed)) with the smallest correct surface.

---
## 1. Core Migration Goal
Produce a lean view component that:
* Uses functional required inputs `id`, `type`, `theme` (signals) – NO inheritance.
* Has a static `DEFAULT_CONFIG` (full shape; never partial patch objects scattered around).
* Injects `WidgetRuntimeDirective` for merged config & persistence and `WidgetStreamsDirective` for all path subscriptions (plus `WidgetMetadataDirective` only if zones used).
* Uses `effect()` blocks for: config/theme reactions, stream registrations, optional highlights/scale/color recompute.
* Contains only presentation logic + lightweight reactive state (signals/computed). No manual diffing, signature tracking, or subscription arrays.

---
## 2. Minimal Component Skeleton
```ts
@Component({ selector: 'widget-X', templateUrl: './widget-X.component.html', imports:[/* deps */] })
export class WidgetXComponent {
  id = input.required<string>();
  type = input.required<string>();
  theme = input.required<ITheme|null>();
  static readonly DEFAULT_CONFIG: IWidgetSvcConfig = { /* full config incl. paths */ };

  private runtime = inject(WidgetRuntimeDirective);
  private streams = inject(WidgetStreamsDirective);
  // optional: private metadata = inject(WidgetMetadataDirective);

  value = signal<number|null>(null);
  label = signal<string>('');

  constructor() {
    // Data stream
    effect(() => {
      const cfg = this.runtime.options();
      const path = cfg?.paths?.gaugePath?.path;
      if (!cfg || !path) return;
      untracked(() => {
        this.streams.observe('gaugePath', pkt => {
          const v = pkt?.data?.value as number | null;
          this.value.set(v);
        });
      });
    });

    // Theme + color (lazy)
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        const palette = getColors(cfg.color, theme);
        // assign palette / signal values
      });
    });
  }
}
```

Template: remove `<widget-host>`; Host2 host & directives are applied at higher layout level (runtime provides config via directive). Bind signals directly.

---
## 3. Streams Directive Rules
* Use `streams.observe(pathKey, cb)` inside an `effect` reacting to `runtime.options()`.
* NO local: `streamRegistered`, `lastPath`, signature hashing, manual unit conversion, or sampleTime handling.
* Guard optional paths simply: `if (!cfg?.paths?.foo?.path) return;`.
* Handle null/timeouts inside the callback (packet fields: `data.value`, `state`).

---
## 4. Metadata (Zones) – Only If Needed
Inject `WidgetMetadataDirective` ONLY if the widget visually renders zone bands (highlights) or derives state (Alarm/Warn/etc) from zones metadata. Otherwise omit it entirely.

Simplest pattern (mirrors `widget-simple-linear`):
```ts
private metadata = inject(WidgetMetadataDirective, { optional: true });

// Zones metadata observation (idempotent)
effect(() => {
  const cfg = this.runtime.options();
  if (!cfg || cfg.ignoreZones || !this.metadata) return;
  // We don't want observe() itself to register as a reactive dependency.
  untracked(() => this.metadata.observe('gaugePath'));
});
```

Access zones directly: `const zones = this.metadata?.zones() ?? [];`

Notes:
* The directive exposes a signal already; do NOT wrap with `toSignal()`.
* Call `observe()` once per path key you need zones for; it's idempotent and path-diff aware.
* Always read `zones()` inside a computed/effect before returning so Angular tracks it.
* Guard with `cfg.ignoreZones` so unnecessary subscriptions are skipped when zones disabled.

---
## 5. Highlights (getHighlights)
Use ONLY for visual zone bands (e.g., gauges). Skip for widgets that just show numbers/text.

Recompute triggers (implicit via dependencies you read inside the computed/effect):
* zones() array reference
* scale bounds (min/max or adjusted scale)
* unit / orientation changes
* ignoreZones toggle

Pattern using `computed` (adapt from `widget-simple-linear`):
```ts
protected readonly highlights = computed<IDataHighlight[]>(() => {
  const zones = this.metadata.zones(); // reading establishes dependency
  const cfg = this.runtime.options();
  const theme = this.theme();
  if (!cfg || !theme) return [];
  if (cfg.ignoreZones || !this.metadata) return [];
  if (!zones?.length) return [];

  const unit = cfg.paths.gaugePath.convertUnitTo;
  const min = cfg.displayScale.lower;        // or adjustedScale.min
  const max = cfg.displayScale.upper;        // or adjustedScale.max
  return getHighlights(zones, theme, unit, this.unitsService, min, max);
});
```

Alternatively, use an `effect` updating a `highlights` signal if you need imperative post-processing. Prefer `computed` when the result derives purely from other signals.

Rules:
* Don't manually clamp/sort zones; helper manages ordering & scaling.
* Always early-return fast for disabled or empty states to minimize work.
* Avoid `untracked` inside this computed—dependencies must be tracked so recompute fires.

---
## 6. Scale & Theme Utilities
`adjustLinearScaleAndMajorTicks(lower, upper, invert?)` – run once per config change if ticks enabled; feed min/max to both gauge options & highlights.

`getColors(colorKey, theme)` – single source for palette; never hardcode hex. Apply before zone state overrides (Alarm/Warn/etc).
Combine both inside one config/theme effect.

---
## 7. PUT / Interactive Widgets
* Use `SignalkRequestsService.putRequest(path, value, id())`.
* Single subscription to `subscribeRequest()` for feedback; unsubscribe on destroy.
* Debounce or snap values (like slider) before sending; keep separate from data observation effect.

---
## 8. Migration Checklist
1. Identify widget type key & existing paths.
2. Create new component: functional inputs + static `DEFAULT_CONFIG`.
3. Inject runtime & streams (+ metadata only if zones needed).
4. Replace all manual subscriptions with `streams.observe`.
5. Move any `startWidget()` init -> effects (config/theme, data, highlights, scale, PUT setup).
6. Delete local path/signature guards & subscription arrays.
7. Wrap theme dependent logic in effects (lazy color maps/palettes).
8. Implement highlights via `getHighlights` (if needed) & scale via `adjustLinearScaleAndMajorTicks`.
9. Registration: Ensure an entry exists in `widget.service.ts` with:
  * `selector` matching the component's `@Component({ selector })`.
  * `componentClassName` matching the exported class name.
  If already present (legacy), keep the same selector & name; do NOT change the external widget type key. Only rename class if necessary and update `componentClassName` accordingly.
  (Static `DEFAULT_CONFIG` is discovered via runtime—no manual wiring needed.)
10. Build & lint; smoke test config edits & live data.
11. Remove obsolete legacy spec/helpers.

---
## 9. Pitfalls -> Fix
| Problem | Fix |
|---------|-----|
| NG0950 accessing theme early | Only read inside effects / lazy methods |
| Duplicate subscriptions | Rely on directive idempotent observe; stable callbacks |
| No updates after path change | Removed local guard? ensure – yes; else delete it |
| Missing unit conversion | Must use `streams.observe` (never raw DataService) |
| Excess highlight recompute | Effect deps only (zones/scale/unit/orientation/ignoreZones) |
| Hardcoded colors | Use `getColors` or theme roles |

---
### Untracked Usage Guidance
Use `untracked(() => ...)` only when performing side-effectful calls or one-time registrations inside an effect after you've already READ all reactive dependencies you want that effect to depend upon.

Good examples:
* Calling `streams.observe(...)` after reading `cfg` & `path`.
* Calling `metadata.observe(...)` after confirming `cfg.ignoreZones` is false.
* Assigning multiple signals based on already captured reactive values (batch-like scenario).

Avoid inside `computed` blocks producing derived data (like highlights) because it suppresses dependency tracking for anything read inside untracked.

---
## 10. AI Request Template
```
Migrate widget <NAME> to Host2.
Notes: <special behaviors / keep template / zones?>
```
Expect: new TS, updated HTML (remove <widget-host>), service registration snippet, notes on changes.

---
## 11. Do / Don't
Do: functional inputs, static config, effects, runtime.options(), streams.observe(), getHighlights (when zone bands), adjustLinearScaleAndMajorTicks, getColors.
Don't: extend BaseWidgetComponent, manual diffing, custom unit math, early theme access, redundant highlight logic, signature flags.

---
## 12. Reference (Directive Behaviors)
`WidgetRuntimeDirective.options()` – merged persisted + defaults (undefined until ready).
`WidgetStreamsDirective.observe(key, cb)` – sets up data pipe: diffing, unit conversion (numbers), sampleTime, timeout/retry.
`WidgetMetadataDirective.observe(key)` – zones diffing (idempotent) only when required.

---
## 13. Closing Principle
Keep widgets declarative glue: config -> effects -> signals -> template. Push mechanics (diffing, units, timeouts, zones transforms) down into shared directives & utils.

(End Concise Prompt)
