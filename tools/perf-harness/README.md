# KIP freeze-audit measurement harness

Reproducible, honest before/after measurement of the main-thread **freezes** users
report ("randomly unresponsive; can't exit fullscreen"). Self-contained — its deps
live in `perf-harness/package.json` and never touch the app's `package.json`.

## What it measures (the symptom, not proxies)

The same probe (`probe.js`) is injected into every build under test via Playwright
`addInitScript`, so measurement code is identical across branches:

| Metric | Meaning |
|---|---|
| `longTaskMaxMs` / `blockingTimeMs` | Longest single main-thread task, and total blocking time (Σ max(0, dur−50)). The browser's own "the main thread was stuck" signal. |
| `taskLatencyMaxMs` / `p95` | A 16 ms self-rescheduling timer's lateness = **how long a queued handler (e.g. the exit-fullscreen keydown) waits**. The honest "frozen" proxy. |
| `frameMaxGapMs` / `framesDropped` | rAF inter-frame gaps → dropped frames. |
| `heapGrowthMB` / `heapSlopeKBps` | `usedJSHeapSize` slope over time (unbounded-growth findings). |

## How it works

`run.mjs` builds a branch's **production** bundle in an isolated git worktree
(`lib/build-serve.mjs`), serves it plus a **mock Signal K server** on one origin
(`lib/server.mjs` — no CORS), injects the probe + a localStorage config that puts
KIP in anonymous local mode (`lib/kip-config.mjs`), throttles CPU via CDP to emulate
low-power marine hardware, runs each scenario K times, and writes
`results/<label>.json` (raw + median/p95).

## Scenarios → audit findings (`scenarios.mjs`)

| Scenario | Reproduces |
|---|---|
| `resize-storm` | Rank 1 — shared ResizeObserver reallocates every canvas in one task (the fullscreen enter/exit storm). |
| `delta-storm-30x10` / `reconnect-backlog` | Rank 2 — delta ingestion / reconnect snapshot fan-out. |
| `ais-radar-150` | Ranks 4/5 — AIS radar full re-render loops. |
| `gauges-16` | Rank 7 — ng-canvas-gauge animation duty cycle. |
| `ais-growth-churn` | Ranks 8/9 — unbounded AIS/track growth (heap slope). |

## Run

```bash
cd perf-harness && npm install
# baseline a branch (throttle defaults to 10x CPU):
node run.mjs --branch master --label master
node run.mjs --branch integration/perf-preview --label perf-preview
# fast iteration against an already-built ./public:
node run.mjs --public ../public --label dev --scenarios ais-radar-150 --repeats 2
```

## Honesty safeguards

- Identical probe + scenarios + fixed CPU throttle across all branches; Chrome
  version recorded in each result.
- K repeats reported as **median and p95**, with every raw run kept in the JSON.
- Baselines captured on `master` (pre-perf) **and** `integration/perf-preview`
  (master + the 5 `perf/*` PRs) so perf gains and freeze-fix gains are never conflated.
- Negative results are reported too (e.g. the delta fan-out is *not* a measurable
  freeze at realistic rates — the rendering loops are).
