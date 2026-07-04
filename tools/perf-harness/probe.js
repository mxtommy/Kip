/*
 * KIP performance probe — injected into the page via Playwright addInitScript
 * BEFORE any app code runs, so identical measurement code is used across every
 * branch/build under test (master, integration/perf-preview, freeze fixes).
 *
 * It measures the *symptom* — main-thread blocking and responsiveness — not
 * proxy microbenchmarks:
 *
 *  - longtasks:      PerformanceObserver('longtask') — every task >50ms (the
 *                    browser's own definition of "the main thread was blocked").
 *  - blockingTime:   Total Blocking Time proxy = sum(max(0, dur-50)) over tasks.
 *  - taskLatency:    a MessageChannel canary posts to itself continuously; the
 *                    delay before the reply runs = how long a queued handler
 *                    (e.g. the exit-fullscreen keydown) would wait. This is the
 *                    honest proxy for "the UI is frozen / can't exit fullscreen".
 *  - frameGaps:      requestAnimationFrame inter-frame gaps — dropped frames.
 *  - heap:           usedJSHeapSize samples over time (growth-slope findings).
 *
 * Everything is exposed on window.__perf. The harness calls __perf.reset()
 * before a scenario window and __perf.snapshot() after.
 */
(() => {
  if (window.__perf) return;

  const state = {
    startedAt: performance.now(),
    longtasks: [],       // { start, duration }
    taskLatency: [],     // ms of canary reply delay
    frameGaps: [],       // ms between rAF callbacks
    heap: [],            // { t, used }
    marks: {},           // name -> [durations ms]
    windowStart: performance.now(),
  };

  // --- Long tasks (main-thread blocking) ---
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.longtasks.push({ start: e.startTime, duration: e.duration });
      }
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* longtask unsupported */ }

  // --- Event-loop lag canary (task-queue responsiveness) ---
  // A self-rescheduling timer measures how much LATER than its interval it
  // actually fires. That lateness == how long an already-queued handler (e.g.
  // the exit-fullscreen keydown) would sit starved while the thread is busy.
  const CANARY_PERIOD_MS = 16;
  let scheduledAt = performance.now();
  function tick() {
    const lateness = performance.now() - scheduledAt - CANARY_PERIOD_MS;
    if (lateness > 0) state.taskLatency.push(lateness);
    scheduledAt = performance.now();
    setTimeout(tick, CANARY_PERIOD_MS);
  }
  setTimeout(tick, CANARY_PERIOD_MS);

  // --- Frame gaps (rendering smoothness) ---
  let lastFrame = performance.now();
  function frame(now) {
    const gap = now - lastFrame;
    lastFrame = now;
    if (gap > 0) state.frameGaps.push(gap);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- Heap sampling ---
  const perfMem = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
  setInterval(() => {
    const used = perfMem();
    if (used != null) state.heap.push({ t: performance.now(), used });
  }, 500);

  // --- Custom marks the harness / app can bracket operations with ---
  function measure(name, fn) {
    const t0 = performance.now();
    const r = fn();
    const record = () => {
      const d = performance.now() - t0;
      (state.marks[name] = state.marks[name] || []).push(d);
    };
    if (r && typeof r.then === 'function') { r.then(record, record); return r; }
    record();
    return r;
  }

  function pct(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  }

  window.__perf = {
    reset() {
      state.windowStart = performance.now();
      state.longtasks.length = 0;
      state.taskLatency.length = 0;
      state.frameGaps.length = 0;
      // keep heap series (growth is measured across the whole run)
      for (const k of Object.keys(state.marks)) delete state.marks[k];
    },
    mark: measure,
    snapshot() {
      const durMs = performance.now() - state.windowStart;
      const lts = state.longtasks;
      const blockingTime = lts.reduce((a, e) => a + Math.max(0, e.duration - 50), 0);
      const heap = state.heap;
      let heapSlope = 0;
      if (heap.length > 1) {
        const first = heap[0], last = heap[heap.length - 1];
        heapSlope = (last.used - first.used) / ((last.t - first.t) / 1000); // bytes/sec
      }
      const marks = {};
      for (const [k, v] of Object.entries(state.marks)) {
        marks[k] = { count: v.length, max: Math.max(...v), p50: pct(v, 50), p95: pct(v, 95) };
      }
      return {
        windowMs: Math.round(durMs),
        longTasks: {
          count: lts.length,
          totalMs: Math.round(lts.reduce((a, e) => a + e.duration, 0)),
          maxMs: Math.round(lts.reduce((a, e) => Math.max(a, e.duration), 0)),
          blockingTimeMs: Math.round(blockingTime),
        },
        taskLatencyMs: {
          samples: state.taskLatency.length,
          maxMs: Math.round(state.taskLatency.reduce((a, b) => Math.max(a, b), 0)),
          p95Ms: Math.round(pct(state.taskLatency, 95)),
        },
        frames: {
          samples: state.frameGaps.length,
          maxGapMs: Math.round(state.frameGaps.reduce((a, b) => Math.max(a, b), 0)),
          p95GapMs: Math.round(pct(state.frameGaps, 95)),
          droppedOver50ms: state.frameGaps.filter((g) => g > 50).length,
        },
        heap: {
          samples: heap.length,
          firstBytes: heap.length ? heap[0].used : null,
          lastBytes: heap.length ? heap[heap.length - 1].used : null,
          slopeBytesPerSec: Math.round(heapSlope),
        },
        marks,
      };
    },
  };
})();
