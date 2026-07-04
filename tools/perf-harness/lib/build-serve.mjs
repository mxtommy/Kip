/*
 * Cross-branch build+serve helpers. To measure a branch honestly we build the
 * REAL production bundle for that exact ref in an isolated git worktree, then
 * serve it. The harness itself (which lives only on the harness branch) is never
 * part of the measured bundle — identical measurement code, different builds.
 */
import { spawn } from 'node:child_process';
import { rm, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HARNESS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(HARNESS_DIR);
const WORKTREES = join(HARNESS_DIR, 'worktrees');

export function sh(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} -> ${code}`))));
    p.on('error', reject);
  });
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

/** Create/refresh a worktree for `ref`, install deps, build prod. Returns the public/ dir. */
export async function buildBranch(ref, label, { rebuild = true } = {}) {
  await mkdir(WORKTREES, { recursive: true });
  const wt = join(WORKTREES, label);
  const publicDir = join(wt, 'public');

  if (rebuild && await exists(wt)) {
    await sh('git', ['worktree', 'remove', '--force', wt], { cwd: REPO_DIR }).catch(() => {});
    await rm(wt, { recursive: true, force: true });
  }
  if (!(await exists(wt))) {
    console.log(`[build] worktree ${label} <- ${ref}`);
    await sh('git', ['worktree', 'add', '--force', wt, ref], { cwd: REPO_DIR });
  }
  // npm install (not ci): the integration branch's lockfile trips npm ci's strict
  // platform-optional-dep check; install reconciles it. Worktree is disposable.
  console.log(`[build] npm install (${label}) …`);
  await sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: wt });
  console.log(`[build] production build (${label}) …`);
  await sh('npm', ['run', 'build:prod'], { cwd: wt });
  if (!(await exists(join(publicDir, 'index.html')))) {
    throw new Error(`build for ${label} produced no public/index.html`);
  }
  return publicDir;
}

/** Start the static SPA server for a built public dir. Returns {url, base, stop()}. */
export async function serve(publicDir, port, base = '/@mxtommy/kip/') {
  const child = spawn('node', [join(HARNESS_DIR, 'serve.mjs'), '--root', publicDir, '--port', String(port), '--base', base], {
    stdio: 'inherit',
  });
  // Wait for it to accept connections.
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${port}${base}index.html`);
      if (r.ok) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    url: `http://localhost:${port}${base}`,
    base,
    stop() { child.kill('SIGTERM'); },
  };
}

export { REPO_DIR, HARNESS_DIR, WORKTREES };
