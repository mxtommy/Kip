/*
 * Deterministic AIS-radar screenshot for visual verification.
 *   node screenshot.mjs --public ../public --label before --port 4420
 * Loads the radar with a fixed scene (own-ship + targets at known bearings/ranges)
 * so before/after images are directly comparable. Writes results/shots/<label>.png.
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './lib/server.mjs';
import { aisRadarWidget, buildDashboards, localStorageBundle } from './lib/kip-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const publicDir = arg('public', join(HERE, '..', 'public'));
const label = arg('label', 'radar');
const port = Number(arg('port', '4420'));

// Deterministic scene: own-ship + targets at fixed bearings/ranges (nm).
const own = { lat: 47.6, lon: -122.33, heading: 45, cog: 45, sog: 6 };
const place = (bearingDeg, rangeNm, extra) => {
  const b = bearingDeg * Math.PI / 180;
  const dLat = (rangeNm / 60) * Math.cos(b);
  const dLon = (rangeNm / 60) * Math.sin(b) / Math.cos(own.lat * Math.PI / 180);
  return { lat: own.lat + dLat, lon: own.lon + dLon, heading: (bearingDeg + 90) % 360, cog: (bearingDeg + 90) % 360, sog: 5, ...extra };
};
let mmsi = 200000000;
const targets = [];
for (const r of [3, 7]) for (const b of [0, 45, 90, 135, 180, 225, 270, 315]) targets.push({ mmsi: mmsi++, ...place(b, r) });
// two targets well beyond a 12nm ring (to visually check range culling later)
for (const b of [30, 210]) targets.push({ mmsi: mmsi++, ...place(b, 20, { sog: 9 }) });

const server = await startServer({ publicDir, base: '/@mxtommy/kip/', port });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
const bundle = localStorageBundle({ origin: server.origin, subscribeAll: true, dashboards: buildDashboards([aisRadarWidget()]) });
await ctx.addInitScript({ content: `window.__KIP_TEST__=true;` + Object.entries(bundle).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('') });
const page = await ctx.newPage();

server.setControl({ streaming: true, staticScene: { ownShip: own, targets } });
await page.goto(server.appUrl + '#/dashboard/0', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('widget-ais-radar', { timeout: 20000 });
await page.waitForTimeout(3500); // let the scene stream in and the radar settle

await mkdir(join(HERE, 'results', 'shots'), { recursive: true });
const out = join(HERE, 'results', 'shots', `${label}.png`);
await page.locator('widget-ais-radar').screenshot({ path: out });
console.log(`[shot] ${out}  (deltas: ${server.streamCount()}, targets: ${targets.length})`);

await browser.close();
await server.stop();
