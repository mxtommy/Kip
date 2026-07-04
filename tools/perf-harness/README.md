# KIP Performance Measurement Harness

Reproducible, honest before/after measurement of the main-thread **freezes**. Self-contained — its deps live in `perf-harness/package.json` and never touch the app's `package.json`.

### What it measures (the symptom, not proxies)

The same probe (`probe.js`) is injected into every build under test via Playwright
`addInitScript`, so measurement code is identical across branches:

| Metric | Meaning |
|---|---|
| `longTaskMaxMs` / `blockingTimeMs` | Longest single main-thread task, and total blocking time (Σ max(0, dur−50)). The browser's own "the main thread was stuck" signal. |
| `taskLatencyMaxMs` / `p95` | A 16 ms self-rescheduling timer's lateness = **how long a queued handler (e.g. the exit-fullscreen keydown) waits**. The honest "frozen" proxy. |
| `frameMaxGapMs` / `framesDropped` | rAF inter-frame gaps → dropped frames. |
| `heapGrowthMB` / `heapSlopeKBps` | `usedJSHeapSize` slope over time (unbounded-growth findings). |

### How it works

`run.mjs` builds a branch's **production** bundle in an isolated git worktree
(`lib/build-serve.mjs`), serves it plus a **mock Signal K server** on one origin
(`lib/server.mjs` — no CORS), injects the probe + a localStorage config that puts
KIP in anonymous local mode (`lib/kip-config.mjs`), throttles CPU via CDP to emulate
low-power marine hardware, runs each scenario K times, and writes
`results/<label>.json` (raw + median/p95).

### Scenarios → audit findings (`scenarios.mjs`)

| Scenario | Reproduces |
|---|---|
| `resize-storm` | Rank 1 — shared ResizeObserver reallocates every canvas in one task (the fullscreen enter/exit storm). |
| `delta-storm-30x10` / `reconnect-backlog` | Rank 2 — delta ingestion / reconnect snapshot fan-out. |
| `ais-radar-150` | Ranks 4/5 — AIS radar full re-render loops. |
| `gauges-16` | Rank 7 — ng-canvas-gauge animation duty cycle. |
| `ais-growth-churn` | Ranks 8/9 — unbounded AIS/track growth (heap slope). |

## Using the Performance Measurement Harness
This section is the end-to-end workflow for the harness tools. The flow is generate metrics (`run.mjs`), then build report (`report.mjs`), then optionally screenshot (`screenshot.mjs`).

### run.mjs

#### 1) Generate perf metric files (`run.mjs`)

Install harness dependencies once:

```bash
cd perf-harness
npm install
```

Generate baseline metrics from two branches:

```bash
node run.mjs --branch master --label master
node run.mjs --branch pr/userX/perf-work --label perf-preview
```

This writes metric files to:

- `results/master.json`
- `results/perf-preview.json`

Use labels to control output names. `--label xyz` writes `results/xyz.json`.

For repeatable comparisons, always pass an explicit `--label`.
If omitted, `run.mjs` generates a unique default label (`<branch>-<UTC timestamp>`),
which avoids accidental reuse of `master` worktree folders.

#### 2) Select what code/build is measured

`run.mjs` supports two ways to choose the code under test:

- `--branch <git-ref>`: builds that branch/ref in an isolated worktree.
- `--public <path>`: uses an already-built app directory instead of building a branch.

Examples:

```bash
# Measure a branch by git ref
node run.mjs --branch integration/perf-preview --label perf-preview

# Measure an existing local build (fast iteration)
node run.mjs --public ../public --label dev
```

```bash
# Measure only scenarion ais-radar-150. Repeat it twice. Use existing local build (fast iteration)
node run.mjs --public ../public --label dev --scenarios ais-radar-150 --repeats 2
```

### report.mjs

After you have at least two metric JSON files in `results/`, generate a markdown report:

```bash
node report.mjs --a master --b perf-preview
```

This reads `results/master.json` and `results/perf-preview.json`, then writes:

- `results/report-master-vs-perf-preview.md`

Use `--out` to choose a custom report path:

```bash
node report.mjs --a master --b perf-preview --out results/reports/my-report.md
```

### screenshot.mjs

Option A: capture post-run screenshots during `run.mjs` for scenarios that opt in via `generateScreenshot: true` in `scenarios.mjs`.

```bash
node run.mjs --branch master --label master --shots
```

This writes screenshots to:

- `results/shots/<run-label>-<scenario>.png`

Option B: capture a standalone deterministic radar screenshot:

```bash
node screenshot.mjs --public ../public --label before
```

This writes:

- `results/shots/before.png`

## Command parameter reference

#### `run.mjs`

| Parameter | Required | Default | Description |
|---|---|---|---|
| `--branch <ref>` | no | `master` | Git ref/branch to build and measure (ignored when `--public` is used). |
| `--public <path>` | no | none | Use an existing built app directory instead of building a branch. |
| `--label <name>` | no | `<sanitized-branch>-<UTC timestamp>` | Output label for `results/<label>.json` and shot filenames. |
| `--scenarios <a,b,...>` | no | all scenarios | Comma-separated scenario labels to run. |
| `--repeats <n>` | no | `4` | Repetitions per scenario. |
| `--throttle <n>` | no | `10` | CPU throttling rate applied through CDP. |
| `--port <n>` | no | `4399` | Local port for the combined app/mock server. |
| `--no-rebuild` | no | off | Reuse existing worktree build when available. |
| `--headed` | no | off | Run Chrome headed instead of headless. |
| `--shots` | no | off | Generate post-run screenshots for scenarios with `generateScreenshot: true`. |

#### `report.mjs`

| Parameter | Required | Default | Description |
|---|---|---|---|
| `--a <label>` | no | `master` | Left baseline label (reads `results/<a>.json`). |
| `--b <label>` | no | `perf-preview` | Right comparison label (reads `results/<b>.json`). |
| `--out <path>` | no | `results/report-<a>-vs-<b>.md` | Output markdown report path. Parent folders are created automatically. |

#### `screenshot.mjs`

| Parameter | Required | Default | Description |
|---|---|---|---|
| `--public <path>` | no | `../public` | Built app directory to serve for capture. |
| `--label <name>` | no | `radar` | Output name for `results/shots/<label>.png`. |
| `--port <n>` | no | `4420` | Local port for the screenshot server instance. |

## Honesty safeguards

- Identical probe + scenarios + fixed CPU throttle across all branches; Chrome
  version recorded in each result.
- K repeats reported as **median and p95**, with every raw run kept in the JSON.
- Baselines captured on `master` (pre-perf) **and** `integration/perf-preview`
  (master + the 5 `perf/*` PRs) so perf gains and freeze-fix gains are never conflated.
- Negative results are reported too (e.g. the delta fan-out is *not* a measurable
  freeze at realistic rates — the rendering loops are).
