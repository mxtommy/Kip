/*
 * Build an honest before/after markdown report from two result files.
 *   node report.mjs --a master --b perf-preview [--out results/report.md]
 * Reads results/<label>.json written by run.mjs.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const A = arg('a', 'master');
const B = arg('b', 'perf-preview');
const OUT = arg('out', join(HERE, 'results', `report-${A}-vs-${B}.md`));

const load = async (label) => JSON.parse(await readFile(join(HERE, 'results', `${label}.json`), 'utf8'));

// metric key -> [display, lowerIsBetter]
const METRICS = [
  ['longTaskMaxMs', 'Longest task (ms)', true],
  ['blockingTimeMs', 'Blocking time (ms)', true],
  ['taskLatencyMaxMs', 'Max handler wait (ms)', true],
  ['taskLatencyP95Ms', 'p95 handler wait (ms)', true],
  ['framesDropped', 'Dropped frames', true],
  ['heapGrowthMB', 'Heap growth (MB)', true],
];

function pctChange(a, b) {
  if (a === 0 && b === 0) return '0%';
  if (a === 0) return b > 0 ? `+${b} (was 0)` : '0%';
  const d = Math.round(((b - a) / Math.abs(a)) * 100);
  return `${d > 0 ? '+' : ''}${d}%`;
}

const a = await load(A), b = await load(B);
const lines = [];
lines.push(`# Freeze metrics: ${A} → ${B}`);
lines.push('');
lines.push(`- CPU throttle: ${a.throttle}× (${A}) / ${b.throttle}× (${B}); repeats: ${a.repeats}/${b.repeats}; Chrome ${a.chrome}`);
lines.push('- Values are **medians** across repeats. Lower is better for every metric.');
lines.push('');

const scenarios = Object.keys(a.scenarios).filter((s) => b.scenarios[s]);
for (const s of scenarios) {
  const sa = a.scenarios[s].agg, sb = b.scenarios[s].agg;
  lines.push(`## ${s}`);
  lines.push(`_${a.scenarios[s].note}_`);
  lines.push('');
  lines.push(`| Metric | ${A} | ${B} | Δ |`);
  lines.push('|---|--:|--:|--:|');
  for (const [k, label] of METRICS) {
    const va = sa[k]?.median ?? 0, vb = sb[k]?.median ?? 0;
    lines.push(`| ${label} | ${va} | ${vb} | ${pctChange(va, vb)} |`);
  }
  lines.push(`| _(context: widgets / deltas)_ | ${sa.widgetCount?.median}/${sa.deltasSent?.median} | ${sb.widgetCount?.median}/${sb.deltasSent?.median} | |`);
  lines.push('');
}

const md = lines.join('\n');
await writeFile(OUT, md);
console.log(md);
console.log(`\n[report] wrote ${OUT}`);
