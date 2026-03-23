import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

function readTestIconsSvg(): string {
  return readFileSync(join(cwd(), 'src/assets/svg/icons.svg'), 'utf-8');
}

// Ensure the real SVG icon set is registered before components render icons.
// Safe to call multiple times; guarded by a window flag.
export function ensureTestIconsReady(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.__KIP_ICONS_REGISTERED__) return;
  const iconRegistry = TestBed.inject(MatIconRegistry);
  const sanitizer = TestBed.inject(DomSanitizer);
  const iconSvg = readTestIconsSvg();
  if (typeof iconSvg === 'string' && iconSvg.length > 0) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(iconSvg, 'image/svg+xml');
    const trusted = sanitizer.bypassSecurityTrustHtml(iconSvg);
    iconRegistry.addSvgIconSetLiteral(trusted);
    iconRegistry.addSvgIconSetInNamespace('kip', trusted);
    const svgs = Array.from(doc.querySelectorAll('svg[id]')) as SVGSVGElement[];
    for (const svg of svgs) {
      const id = svg.getAttribute('id');
      if (!id) continue;
      iconRegistry.addSvgIconLiteral(id, sanitizer.bypassSecurityTrustHtml(svg.outerHTML));
    }
    w.__KIP_ICONS_REGISTERED__ = true;
  } else {
    console.error('[TEST] Failed to load src/assets/svg/icons.svg.');
  }
}
