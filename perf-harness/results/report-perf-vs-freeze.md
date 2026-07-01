# Freeze metrics: perf-preview → freeze-work-v1

- CPU throttle: 10× (perf-preview) / 10× (freeze-work-v1); repeats: 3/3; Chrome 149.0.7827.201
- Values are **medians** across repeats. Lower is better for every metric.

## idle-numeric-24
_baseline render/CD load: 24 numeric widgets, low data rate (WS4 baseline)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 4 | 4 | 0% |
| p95 handler wait (ms) | 3 | 2 | -33% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 1 | 1 | 0% |
| _(context: widgets / deltas)_ | 24/16 | 24/16 | |

## delta-storm-30x10
_sustained ingestion: 30 paths @ 10Hz over a numeric+gauge dashboard (rank 2, delta coalescing)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 3 | 6 | +100% |
| p95 handler wait (ms) | 2 | 2 | 0% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 1 | 1 | 0% |
| _(context: widgets / deltas)_ | 20/118 | 20/118 | |

## reconnect-backlog
_reconnect snapshot: one frame carrying 6000 values (rank 2, single synchronous parse+fan-out long task)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 49 | 46 | -6% |
| p95 handler wait (ms) | 3 | 3 | 0% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 3 | 3 | 0% |
| _(context: widgets / deltas)_ | 20/29 | 20/29 | |

## resize-storm
_28 canvas widgets + repeated viewport resizes: shared ResizeObserver reallocates every canvas in one task (rank 1, the fullscreen enter/exit storm)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 148 | 0 | -100% |
| Blocking time (ms) | 1097 | 0 | -100% |
| Max handler wait (ms) | 263 | 71 | -73% |
| p95 handler wait (ms) | 140 | 43 | -69% |
| Dropped frames | 44 | 3 | -93% |
| Heap growth (MB) | 1 | 1 | 0% |
| _(context: widgets / deltas)_ | 28/14 | 28/14 | |

## ais-radar-150
_150 AIS targets @ 4Hz + streaming own-ship (ranks 4/5, radar render loops)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 1567 | 1164 | -26% |
| Blocking time (ms) | 9690 | 8184 | -16% |
| Max handler wait (ms) | 3436 | 1284 | -63% |
| p95 handler wait (ms) | 3436 | 824 | -76% |
| Dropped frames | 17 | 37 | +118% |
| Heap growth (MB) | 13 | 15 | +15% |
| _(context: widgets / deltas)_ | 1/9513 | 1/7248 | |

## gauges-16
_16 radial ng-canvas-gauges @ 4Hz (rank 7, animation duty cycle)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 0 | 0 | 0% |
| Blocking time (ms) | 0 | 0 | 0% |
| Max handler wait (ms) | 36 | 31 | -14% |
| p95 handler wait (ms) | 12 | 9 | -25% |
| Dropped frames | 0 | 0 | 0% |
| Heap growth (MB) | 2 | 2 | 0% |
| _(context: widgets / deltas)_ | 16/39 | 16/40 | |

## ais-growth-churn
_AIS radar with 40 targets + 40 new MMSIs/sec churn for 30s (ranks 8/9, heap growth)_

| Metric | perf-preview | freeze-work-v1 | Δ |
|---|--:|--:|--:|
| Longest task (ms) | 3871 | 6506 | +68% |
| Blocking time (ms) | 26533 | 22336 | -16% |
| Max handler wait (ms) | 4036 | 8973 | +122% |
| p95 handler wait (ms) | 3912 | 6659 | +70% |
| Dropped frames | 32 | 24 | -25% |
| Heap growth (MB) | 9 | 14 | +56% |
| _(context: widgets / deltas)_ | 1/8330 | 1/7791 | |
