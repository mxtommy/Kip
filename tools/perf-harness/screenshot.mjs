/*
 * Deterministic AIS-radar screenshot for visual verification.
 *   node screenshot.mjs --public ../public --label before --port 4420
 * Writes results/shots/<label>.png.
 */
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './lib/server.mjs';
import { buildRadarScene, captureRadarScreenshot } from './lib/radar-shot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const publicDir = arg('public', join(HERE, '..', 'public'));
const label = arg('label', 'radar');
const port = Number(arg('port', '4420'));

const server = await startServer({ publicDir, base: '/@mxtommy/kip/', port });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const out = await captureRadarScreenshot({
  browser,
  server,
  outDir: join(HERE, 'results', 'shots'),
  fileName: `${label}.png`,
  staticScene: buildRadarScene(),
});
console.log(`[shot] ${out}  (deltas: ${server.streamCount()})`);

await browser.close();
await server.stop();
