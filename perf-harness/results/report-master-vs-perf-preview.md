# Freeze metrics: master → perf-preview

- CPU throttle: 10× (master) / 10× (perf-preview); repeats: 3/3; Chrome 149.0.7827.201
- Values are **medians** across repeats. Lower is better for every metric.

## idle-numeric-24
_baseline render/CD load: 24 numeric widgets, low data rate (WS4 baseline)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 4 | 4 | 0% |
| p95 handler wait (ms) | 3 | 3 | 0% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 0 | 1 | +1 (was 0) |
| _(context: widgets / deltas)_ | 24/16 | 24/16 | |

## delta-storm-30x10
_sustained ingestion: 30 paths @ 10Hz over a numeric+gauge dashboard (rank 2, delta coalescing)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 8 | 3 | -62% |
| p95 handler wait (ms) | 3 | 2 | -33% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 0 | 1 | +1 (was 0) |
| _(context: widgets / deltas)_ | 20/119 | 20/118 | |

## reconnect-backlog
_reconnect snapshot: one frame carrying 6000 values (rank 2, single synchronous parse+fan-out long task)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 56 | 49 | -12% |
| p95 handler wait (ms) | 3 | 3 | 0% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 2 | 3 | +50% |
| _(context: widgets / deltas)_ | 20/29 | 20/29 | |

## resize-storm
_28 canvas widgets + repeated viewport resizes: shared ResizeObserver reallocates every canvas in one task (rank 1, the fullscreen enter/exit storm)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 183 | 148 | -19% |
| Blocking time (ms) | 1774 | 1097 | -38% |
| Max handler wait (ms) | 328 | 263 | -20% |
| p95 handler wait (ms) | 173 | 140 | -19% |
| Dropped frames | 29 | 44 | +52% |
| Heap growth (MB) | -1 | 1 | +200% |
| _(context: widgets / deltas)_ | 28/14 | 28/14 | |

## ais-radar-150
_150 AIS targets @ 4Hz + streaming own-ship (ranks 4/5, radar render loops)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 530 | 1567 | +196% |
| Blocking time (ms) | 7215 | 9690 | +34% |
| Max handler wait (ms) | 1025 | 3436 | +235% |
| p95 handler wait (ms) | 723 | 3436 | +375% |
| Dropped frames | 47 | 17 | -64% |
| Heap growth (MB) | 4 | 13 | +225% |
| _(context: widgets / deltas)_ | 1/7248 | 1/9513 | |

## gauges-16
_16 radial ng-canvas-gauges @ 4Hz (rank 7, animation duty cycle)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 35 | 36 | +3% |
| p95 handler wait (ms) | 11 | 12 | +9% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 1 | 2 | +100% |
| _(context: widgets / deltas)_ | 16/40 | 16/39 | |

## ais-growth-churn
_AIS radar with 40 targets + 40 new MMSIs/sec churn for 30s (ranks 8/9, heap growth)_

| Metric | master | perf-preview | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 5636 | 3871 | -31% |
| Blocking time (ms) | 23973 | 26533 | +11% |
| Max handler wait (ms) | 6486 | 4036 | -38% |
| p95 handler wait (ms) | 2942 | 3912 | +33% |
| Dropped frames | 46 | 32 | -30% |
| Heap growth (MB) | 7 | 9 | +29% |
| _(context: widgets / deltas)_ | 1/7693 | 1/8330 | |
