/*
 * Deterministic AIS-radar screenshot capture shared by screenshot.mjs and run.mjs.
 * The capture runs in a separate browser context after the perf snapshot so it does
 * not affect the measured task window.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { aisRadarWidget, buildDashboards, localStorageBundle } from './kip-config.mjs';

const VIEWPORT = { width: 900, height: 900 };
const DEVICE_SCALE_FACTOR = 2;
const SETTLE_MS = 3500;

function radianPlace(own, bearingDeg, rangeNm, extra) {
  const b = bearingDeg * Math.PI / 180;
  const dLat = (rangeNm / 60) * Math.cos(b);
  const dLon = (rangeNm / 60) * Math.sin(b) / Math.cos(own.lat * Math.PI / 180);
  return { lat: own.lat + dLat, lon: own.lon + dLon, heading: (bearingDeg + 90) % 360, cog: (bearingDeg + 90) % 360, sog: 5, ...extra };
}

export function buildRadarScene() {
  const own = { lat: 47.6, lon: -122.33, heading: 45, cog: 45, sog: 6 };
  let mmsi = 200000000;
  const targets = [];
  for (const r of [3, 7]) for (const b of [0, 45, 90, 135, 180, 225, 270, 315]) targets.push({ mmsi: mmsi++, ...radianPlace(own, b, r) });
  for (const b of [30, 210]) targets.push({ mmsi: mmsi++, ...radianPlace(own, b, 20, { sog: 9 }) });
  return { own, targets };
}

/**
 * Capture a radar screenshot for either the current scenario state or a
 * deterministic standalone scene.
 * @param {object} options
 * @param {import('playwright-core').Browser} options.browser Playwright browser instance.
 * @param {object} options.server Harness server returned by startServer().
 * @param {string} options.outDir Directory that will receive the screenshot.
 * @param {string} options.fileName Screenshot file name.
 * @param {Array<object>} [options.dashboards] Dashboard definitions to inject.
 * @param {boolean} [options.subscribeAll] Whether the app should subscribe to all paths.
 * @param {object} [options.control] Server control to apply when capturing from live scenario data.
 * @param {object} [options.staticScene] Optional fixed scene for the standalone helper.
 * @returns {Promise<string>} Absolute screenshot path.
 */
export async function captureRadarScreenshot({ browser, server, outDir, fileName, dashboards, subscribeAll = true, control, staticScene }) {
  const sceneDashboards = dashboards ?? buildDashboards([aisRadarWidget()]);
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR });
  const bundle = localStorageBundle({ origin: server.origin, subscribeAll, dashboards: sceneDashboards });
  await ctx.addInitScript({ content: `window.__KIP_TEST__=true;` + Object.entries(bundle).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('') });
  const page = await ctx.newPage();

  if (staticScene) server.setControl({ streaming: true, staticScene });
  else if (control) server.setControl({ streaming: true, ...control });
  await page.goto(server.appUrl + '#/dashboard/0', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('widget-host2', { timeout: 20000 });
  await page.waitForTimeout(SETTLE_MS);

  await mkdir(outDir, { recursive: true });
  const out = join(outDir, fileName);

  const radar = page.locator('widget-ais-radar');
  if (await radar.count()) await radar.first().screenshot({ path: out });
  else await page.locator('widget-host2').first().screenshot({ path: out });

  await ctx.close();
  return out;
}
