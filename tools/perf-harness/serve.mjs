/*
 * Minimal static SPA server for a built KIP bundle.
 * KIP builds to <root>/public with <base href="/@mxtommy/kip/">, so we mount the
 * files under that base and SPA-fallback unknown routes to index.html.
 *
 * Usage: node serve.mjs --root /path/to/worktree/public --port 4321 [--base /@mxtommy/kip/]
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const ROOT = arg('root', 'public');
const PORT = Number(arg('port', '4321'));
let BASE = arg('base', '/@mxtommy/kip/');
if (!BASE.endsWith('/')) BASE += '/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.map': 'application/json',
};

async function tryFile(p) {
  try { const s = await stat(p); if (s.isFile()) return p; } catch { /* nope */ }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Redirect bare root to the app base so relative asset URLs resolve.
    if (urlPath === '/' ) { res.writeHead(302, { Location: BASE }); return res.end(); }
    // Strip the base prefix.
    let rel = urlPath.startsWith(BASE) ? urlPath.slice(BASE.length) : urlPath.replace(/^\//, '');
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, rel);

    let resolved = await tryFile(filePath);
    // SPA fallback: unknown route with no file extension -> index.html
    if (!resolved && !extname(rel)) resolved = await tryFile(join(ROOT, 'index.html'));
    if (!resolved) { res.writeHead(404); return res.end('not found: ' + rel); }

    const body = await readFile(resolved);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(resolved)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(PORT, () => {
  console.log(`[serve] ${ROOT} at http://localhost:${PORT}${BASE}`);
});

// Allow the parent (run.mjs) to shut us down cleanly.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('message', (m) => { if (m === 'shutdown') server.close(() => process.exit(0)); });
