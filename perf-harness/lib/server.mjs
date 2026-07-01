/*
 * Combined server for the harness: serves the built KIP app under `base`
 * AND acts as the mock Signal K server (/signalk/ discovery, WS delta stream,
 * v2 history) on the SAME origin — so signalKUrl is same-origin (no CORS) and
 * the app talks to a fully controllable data source.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import { SELF_URN } from './kip-config.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.map': 'application/json',
};

const iso = (t) => new Date(t).toISOString();

function genSelfValue(path, t) {
  switch (path) {
    case 'navigation.speedOverGround': return 5 + 2 * Math.sin(t / 1000);
    case 'navigation.headingTrue':
    case 'navigation.courseOverGroundTrue': return ((t / 40) % 360) * Math.PI / 180;
    case 'navigation.position': return { latitude: 47.6 + 0.001 * Math.sin(t / 4000), longitude: -122.33 + 0.001 * Math.cos(t / 4000) };
    case 'environment.depth.belowTransducer': return 12 + 3 * Math.sin(t / 2000);
    case 'environment.wind.angleApparent': return Math.sin(t / 1000);
    case 'environment.wind.speedApparent': return 8 + 3 * Math.sin(t / 1500);
    default: return Math.sin(t / 1000) * 100;
  }
}

function selfDelta(paths, t) {
  return JSON.stringify({ context: SELF_URN, updates: [{ $source: 'mock.0', timestamp: iso(t), values: paths.map((p) => ({ path: p, value: genSelfValue(p, t) })) }] });
}

function aisDelta(mmsi, i, t) {
  return JSON.stringify({
    context: `vessels.urn:mrn:imo:mmsi:${mmsi}`,
    updates: [{ $source: 'mock.ais', timestamp: iso(t), values: [
      { path: 'navigation.position', value: { latitude: 47.6 + 0.02 * Math.sin(t / 3000 + i), longitude: -122.33 + 0.02 * Math.cos(t / 3000 + i) } },
      { path: 'navigation.headingTrue', value: ((i * 11 + t / 50) % 360) * Math.PI / 180 },
      { path: 'navigation.courseOverGroundTrue', value: ((i * 11) % 360) * Math.PI / 180 },
      { path: 'navigation.speedOverGround', value: 3 + (i % 6) },
      { path: 'mmsi', value: String(mmsi) },
    ] }],
  });
}

function helloMsg() {
  return JSON.stringify({ name: 'kip-mock', version: '2.3.0', self: SELF_URN, roles: ['master', 'main'], timestamp: iso(Date.now()) });
}

function historyResponse(paths, rows, stepSec) {
  const base = Date.parse('2026-06-30T00:00:00.000Z');
  const values = paths.flatMap((p) => [{ path: p, method: 'sma' }, { path: p, method: 'avg' }, { path: p, method: 'min' }, { path: p, method: 'max' }]);
  const data = [];
  for (let i = 0; i < rows; i++) {
    const row = [iso(base + i * stepSec * 1000)];
    for (let k = 0; k < values.length; k++) row.push(5 + Math.sin((i + k) / 10));
    data.push(row);
  }
  return { context: 'vessels.self', range: { from: iso(base), to: iso(base + rows * stepSec * 1000) }, values, data };
}

/**
 * @param {object} o { publicDir, base, port }
 * Returns { origin, appUrl, setControl(c), blast(n), streamCount(), stop() }.
 * control: { streaming:bool, rateHz, selfPaths:[], ais:{count, churnPerSec} }
 */
export async function startServer({ publicDir, base, port }) {
  const control = { streaming: false, rateHz: 10, selfPaths: ['navigation.speedOverGround'], ais: { count: 0, churnPerSec: 0 } };
  let history = { rows: 0, stepSec: 1, paths: ['navigation.speedOverGround'] };
  let sent = 0;
  let mmsiBase = 100000000;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    // --- Signal K endpoints (origin root) ---
    if (p === '/signalk' || p === '/signalk/') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        endpoints: { v1: { version: '2.3.0', 'signalk-http': `http://localhost:${port}/signalk/v1/api/`, 'signalk-ws': `ws://localhost:${port}/signalk/v1/stream` } },
        server: { id: 'kip-mock', version: '2.3.0' },
      }));
    }
    if (p.startsWith('/signalk/v2/api/history/values')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(historyResponse(history.paths, history.rows, history.stepSec)));
    }
    if (p.startsWith('/signalk/v1/api')) { // snapshot / misc — empty model
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end('{}');
    }
    // --- static app ---
    let rel = p.startsWith(base) ? p.slice(base.length) : p.replace(/^\//, '');
    if (p === '/') { res.writeHead(302, { Location: base }); return res.end(); }
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '');
    let file = join(publicDir, rel);
    try { if (!(await stat(file)).isFile()) throw 0; } catch {
      if (!extname(rel)) file = join(publicDir, 'index.html'); else { res.writeHead(404); return res.end('nf'); }
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });

  const wss = new WebSocketServer({ server, path: '/signalk/v1/stream' });
  wss.on('connection', (ws) => {
    ws.send(helloMsg());
    let tick = 0;
    const timer = setInterval(() => {
      if (!control.streaming || ws.readyState !== ws.OPEN) return;
      const t = Date.now();
      ws.send(selfDelta(control.selfPaths, t)); sent++;
      const n = control.ais.count | 0;
      for (let i = 0; i < n; i++) { ws.send(aisDelta(mmsiBase + i, i, t)); sent++; }
      // churn: introduce brand-new MMSIs over time (unbounded-growth scenario)
      const churn = control.ais.churnPerSec | 0;
      if (churn) {
        const per = Math.max(1, Math.round(churn / control.rateHz));
        for (let c = 0; c < per; c++) { mmsiBase++; ws.send(aisDelta(mmsiBase + n, n + c, t)); sent++; }
      }
      tick++;
    }, Math.max(1, Math.round(1000 / control.rateHz)));
    ws.on('close', () => clearInterval(timer));
    // Many separate frames (sustained flood) — each is its own onmessage task.
    ws._blast = (count) => { const t = Date.now(); for (let i = 0; i < count; i++) { ws.send(selfDelta(control.selfPaths, t + i)); sent++; } };
    // ONE frame carrying many values (reconnect snapshot) — a single synchronous
    // parse + fan-out, i.e. the worst-case long task that coalescing must bound.
    ws._blastBig = (nValues) => {
      const t = Date.now();
      const values = [];
      for (let i = 0; i < nValues; i++) values.push({ path: `sensors.mock.n${i}.value`, value: Math.sin((t + i) / 1000) });
      ws.send(JSON.stringify({ context: SELF_URN, updates: [{ $source: 'mock.0', timestamp: iso(t), values }] }));
      sent++;
    };
  });

  await new Promise((r) => server.listen(port, r));
  const origin = `http://localhost:${port}`;
  return {
    origin, appUrl: `${origin}${base}`,
    setControl(c) { Object.assign(control, c); if (c.history) history = { ...history, ...c.history }; },
    blast(count) { for (const ws of wss.clients) if (ws._blast) ws._blast(count); },
    blastBig(nValues) { for (const ws of wss.clients) if (ws._blastBig) ws._blastBig(nValues); },
    streamCount() { return sent; },
    stop() { return new Promise((r) => { for (const ws of wss.clients) ws.terminate(); server.close(() => r()); }); },
  };
}
