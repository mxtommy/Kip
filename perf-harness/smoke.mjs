/* Smoke test: verify the browser launch + probe measure a synthetic main-thread block. */
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const probe = await readFile(new URL('./probe.js', import.meta.url), 'utf8');

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const ctx = await browser.newContext();
await ctx.addInitScript({ content: probe });
const page = await ctx.newPage();

// Throttle CPU 4x to emulate a low-power marine display.
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await page.goto('data:text/html,<title>smoke</title><body>smoke</body>');
await page.evaluate(() => window.__perf.reset());

// Synthetic 400ms blocking task scheduled as a REAL page task (setTimeout),
// so it is attributed as a long task exactly like the app's own work would be.
await page.evaluate(() => new Promise((resolve) => {
  setTimeout(() => {
    const end = performance.now() + 400;
    while (performance.now() < end) { /* block */ }
    resolve();
  }, 0);
}));
// Let the canary/observers catch up.
await page.waitForTimeout(500);

const snap = await page.evaluate(() => window.__perf.snapshot());
console.log('CHROME:', (await browser.version()));
console.log(JSON.stringify(snap, null, 2));

await browser.close();

// Assert the probe actually saw the block.
if (snap.longTasks.maxMs < 200 && snap.taskLatencyMs.maxMs < 200) {
  console.error('FAIL: probe did not detect the synthetic block');
  process.exit(1);
}
console.log('SMOKE OK: probe detected the block (longtask maxMs=%d, taskLatency maxMs=%d)',
  snap.longTasks.maxMs, snap.taskLatencyMs.maxMs);
