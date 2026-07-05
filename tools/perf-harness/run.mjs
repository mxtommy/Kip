/*
 * Freeze-audit measurement runner.
 *
 *   node run.mjs --branch <ref> --label <name> [--scenarios a,b] [--repeats 5]
 *                [--throttle 4] [--port 4399] [--no-rebuild] [--headed] [--shots]
 *
 * Builds the branch's production bundle in an isolated worktree, serves it +
 * a mock Signal K server on one origin, injects the identical probe + a
 * localStorage config into a throttled Chromium, runs each scenario K times,
 * and writes results/<label>.json (raw + median/p95 aggregate).
 */
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir, access, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBranch, WORKTREES } from './lib/build-serve.mjs';
import { startServer } from './lib/server.mjs';
import { localStorageBundle } from './lib/kip-config.mjs';
import { captureRadarScreenshot } from './lib/radar-shot.mjs';
import { scenarios as ALL } from './scenarios.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = '/@mxtommy/kip/';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

function safeLabelPart(value) {
  return value.replace(/[^\w.-]/g, '_');
}

function defaultLabelFor(branch) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${safeLabelPart(branch)}-${stamp}`;
}

const BRANCH = arg('branch', 'master');
const LABEL = arg('label', defaultLabelFor(BRANCH));
const REPEATS = Number(arg('repeats', '4'));
const THROTTLE = Number(arg('throttle', '10'));
const PORT = Number(arg('port', '4399'));
const SHOTS = flag('shots');
const ONLY = (arg('scenarios', '') || '').split(',').filter(Boolean);
const scenarios = ONLY.length ? ALL.filter((s) => ONLY.includes(s.label)) : ALL;

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p95 = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))]; };

function aggregate(reps) {
  const pick = {
    longTaskCount: (r) => r.longTasks.count,
    longTaskMaxMs: (r) => r.longTasks.maxMs,
    blockingTimeMs: (r) => r.longTasks.blockingTimeMs,
    taskLatencyMaxMs: (r) => r.taskLatencyMs.maxMs,
    taskLatencyP95Ms: (r) => r.taskLatencyMs.p95Ms,
    frameMaxGapMs: (r) => r.frames.maxGapMs,
    framesDropped: (r) => r.frames.droppedOver50ms,
    heapSlopeKBps: (r) => Math.round(r.heap.slopeBytesPerSec / 1024),
    heapGrowthMB: (r) => r.heap.firstBytes != null ? Math.round((r.heap.lastBytes - r.heap.firstBytes) / 1048576) : 0,
    deltasSent: (r) => r.deltasSent || 0,
    widgetCount: (r) => r.widgetCount || 0,
  };
  const out = {};
  for (const [k, f] of Object.entries(pick)) {
    const vals = reps.map(f);
    out[k] = { median: med(vals), p95: p95(vals), all: vals };
  }
  return out;
}

async function prepareBuild() {
  const forced = arg('public', '');
  if (forced) {
    const resolvedPublic = resolve(process.cwd(), forced);
    let info;
    try {
      info = await stat(resolvedPublic);
    } catch {
      throw new Error(
        `[build] --public path not found: ${forced} (resolved: ${resolvedPublic}). ` +
        'From tools/perf-harness use ../../public, or from repo root use ./public.'
      );
    }
    if (!info.isDirectory()) {
      throw new Error(`[build] --public must be a directory: ${forced} (resolved: ${resolvedPublic})`);
    }
    if (!await exists(join(resolvedPublic, 'index.html'))) {
      throw new Error(
        `[build] --public directory is missing index.html: ${forced} (resolved: ${resolvedPublic}). ` +
        'Point --public at a built app output directory.'
      );
    }
    console.log(`[build] using provided public dir: ${forced} (resolved: ${resolvedPublic})`);
    return resolvedPublic;
  }
  const wtPublic = join(WORKTREES, LABEL, 'public');
  if (flag('no-rebuild') && await exists(join(wtPublic, 'index.html'))) {
    console.log(`[build] reusing existing build for ${LABEL}`);
    return wtPublic;
  }
  return buildBranch(BRANCH, LABEL, { rebuild: !flag('no-rebuild') });
}

async function waitForBoot(page, expectedWidgets) {
  await page.waitForSelector('widget-host2', { timeout: 25000 }).catch(() => {});
  // settle a couple of frames
  await page.waitForTimeout(800);
  return page.$$eval('widget-host2', (els) => els.length).catch(() => 0);
}

async function maybeCaptureScreenshot({ browser, server, scenario }) {
  if (!SHOTS || !scenario.generateScreenshot) return null;
  const outDir = join(HERE, 'results', 'shots');
  const fileName = `${LABEL}-${scenario.label}.png`;
  const out = await captureRadarScreenshot({
    browser,
    server,
    outDir,
    fileName,
    dashboards: scenario.dashboards(),
    subscribeAll: scenario.subscribeAll,
    control: scenario.control,
  });
  console.log(`  [shot] ${out}`);
  return out;
}

async function main() {
  const probeJs = await readFile(join(HERE, 'probe.js'), 'utf8');
  const publicDir = await prepareBuild();
  const server = await startServer({ publicDir, base: BASE, port: PORT });
  console.log(`[serve] ${server.appUrl}  (SignalK mock @ ${server.origin})`);

  const browser = await chromium.launch({
    executablePath: CHROME, headless: !flag('headed'),
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  });

  const results = { label: LABEL, branch: BRANCH, throttle: THROTTLE, repeats: REPEATS, chrome: await browser.version(), scenarios: {} };

  for (const s of scenarios) {
    console.log(`\n=== scenario: ${s.label} — ${s.note} ===`);
    const reps = [];
    for (let r = 0; r < REPEATS; r++) {
      const ctx = await browser.newContext();
      await ctx.addInitScript({ content: probeJs });
      const bundle = localStorageBundle({ origin: server.origin, subscribeAll: s.subscribeAll, dashboards: s.dashboards() });
      const injector = `window.__KIP_TEST__ = true;` +
        Object.entries(bundle).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('');
      await ctx.addInitScript({ content: injector });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

      // fresh stream state
      server.setControl({ streaming: false, ais: { count: 0, churnPerSec: 0 } });
      await page.goto(server.appUrl + '#/dashboard/0', { waitUntil: 'load', timeout: 30000 });
      const widgetCount = await waitForBoot(page);

      // start the scenario data profile, warm up, then measure
      server.setControl({ streaming: true, ...s.control });
      const c0 = server.streamCount();
      await page.waitForTimeout(s.warmupMs ?? 1500);
      await page.evaluate(() => window.__perf.reset());
      const sentAtReset = server.streamCount();
      if (s.action) await s.action(page, server, s.durationMs);
      else await page.waitForTimeout(s.durationMs);
      const snap = await page.evaluate(() => window.__perf.snapshot());
      snap.deltasSent = server.streamCount() - sentAtReset;
      snap.widgetCount = widgetCount;
      snap.streamedDuringWarmup = sentAtReset - c0;
      reps.push(snap);
      console.log(`  rep ${r + 1}/${REPEATS}: widgets=${widgetCount} deltas=${snap.deltasSent} longTaskMax=${snap.longTasks.maxMs}ms block=${snap.longTasks.blockingTimeMs}ms taskLatMax=${snap.taskLatencyMs.maxMs}ms heapΔ=${snap.heap.firstBytes != null ? Math.round((snap.heap.lastBytes - snap.heap.firstBytes) / 1048576) : '?'}MB`);
      await ctx.close();
    }
    results.scenarios[s.label] = { note: s.note, agg: aggregate(reps), raw: reps.map((r) => ({ ...r, heap: { ...r.heap } })) };
    await maybeCaptureScreenshot({ browser, server, scenario: s });
  }

  await server.stop();
  await browser.close();

  await mkdir(join(HERE, 'results'), { recursive: true });
  const outPath = join(HERE, 'results', `${LABEL}.json`);
  await writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\n[done] wrote ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
