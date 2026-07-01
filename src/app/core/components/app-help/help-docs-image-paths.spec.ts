import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Guard for #1056.
 *
 * Help markdown is rendered inside KIP while the app is served under a base href
 * (e.g. /@mxtommy/kip/). Image references must resolve against that base, so local image
 * paths have to be base-relative (e.g. `assets/help-docs/img/x.png`). A parent-relative
 * path (`../../assets/...`) climbs above the base href and 404s on a real Signal K server;
 * a root-absolute path (`/assets/...`) drops the base href entirely. Both are forbidden.
 * Absolute http(s) and data: URLs are fine.
 */
const HELP_DOCS_DIR = join(cwd(), 'src/assets/help-docs');

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function extractImageSrcs(markdown: string): string[] {
  const htmlImg = [...markdown.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi)].map(m => m[1]);
  const mdImg = [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map(m => m[1]);
  return [...htmlImg, ...mdImg];
}

function isLocal(src: string): boolean {
  return !/^(https?:)?\/\//i.test(src) && !src.startsWith('data:');
}

describe('help-docs image paths (#1056)', () => {
  it('uses only base-relative local image paths (no ../ or leading /)', () => {
    const offenders: string[] = [];

    for (const file of listMarkdownFiles(HELP_DOCS_DIR)) {
      const content = readFileSync(file, 'utf-8');
      for (const src of extractImageSrcs(content)) {
        if (isLocal(src) && (src.startsWith('../') || src.startsWith('/'))) {
          offenders.push(`${file.replace(cwd() + '/', '')} -> ${src}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
