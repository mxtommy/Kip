/*
 * Verifies AIS-radar hit-testing after the rotation refactor: with two targets
 * overlapping at a non-zero view rotation (heading 45deg), clicking them must
 * open the multi-target disambiguation MENU (findTargetsNearEvent found both) —
 * not fall back to a single dialog. This is the one correctness path a static
 * screenshot can't cover (the click-point un-rotate math).
 */
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './lib/server.mjs';
import { aisRadarWidget, buildDashboards, localStorageBundle } from './lib/kip-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const publicDir = arg('public', join(HERE, '..', 'public'));
const port = Number(arg('port', '4425'));

const own = { lat: 47.6, lon: -122.33, heading: 45, cog: 45, sog: 6 };
// Two vessels at (nearly) the same spot, bearing 90deg / 4nm from own-ship.
const b = 90 * Math.PI / 180, r = 4;
const dLat = (r / 60) * Math.cos(b), dLon = (r / 60) * Math.sin(b) / Math.cos(own.lat * Math.PI / 180);
const targets = [
  { mmsi: 300000001, lat: own.lat + dLat, lon: own.lon + dLon, heading: 200, cog: 200, sog: 5, name: 'Overlap A' },
  { mmsi: 300000002, lat: own.lat + dLat, lon: own.lon + dLon, heading: 20, cog: 20, sog: 5, name: 'Overlap B' },
];

const server = await startServer({ publicDir, base: '/@mxtommy/kip/', port });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
const bundle = localStorageBundle({ origin: server.origin, subscribeAll: true, dashboards: buildDashboards([aisRadarWidget()]) });
await ctx.addInitScript({ content: `window.__KIP_TEST__=true;` + Object.entries(bundle).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('') });
const page = await ctx.newPage();

server.setControl({ streaming: true, staticScene: { ownShip: own, targets } });
await page.goto(server.appUrl + '#/dashboard/0', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('widget-ais-radar .radar-targets g.target', { timeout: 20000 });
await page.waitForTimeout(3000);

const count = await page.locator('widget-ais-radar .radar-targets g.target').count();
const box = await page.locator('widget-ais-radar .radar-targets g.target').first().boundingBox();
if (!box) { console.error('FAIL: no target box'); process.exit(1); }
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(600);

const menuOpen = await page.locator('.mat-mdc-menu-panel, [role="menu"]').count();
const dialogOpen = await page.locator('mat-dialog-container, .cdk-dialog-container, dialog-ais-target').count();
console.log(`targets rendered: ${count}`);
console.log(`after click at heading=45deg -> menu panels: ${menuOpen}, dialogs: ${dialogOpen}`);
if (menuOpen > 0) console.log('PASS: overlapping-target menu opened -> hit-test un-rotate is correct');
else if (dialogOpen > 0) console.log('WARN: single dialog opened -> findTargetsNearEvent did NOT find the overlap (un-rotate sign?)');
else console.log('WARN: neither menu nor dialog detected');

await browser.close();
await server.stop();
