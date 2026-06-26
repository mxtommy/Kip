import { Injectable } from '@angular/core';
import type { ICameraCandidate } from './camera-record.util';

/** Minimal fetch signature so the client is testable without the real network. */
export type DiscoveryFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Thrown when a scan is refused because discovery is rate-limited. */
export class DiscoveryRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Camera discovery is busy — try again shortly');
    this.name = 'DiscoveryRateLimitedError';
  }
}

/**
 * Runs a camera discovery scan through the sk-video plugin (`/plugins/sk-video/cameras/discover`).
 * The scan is rate-limited server-side; a 429 surfaces as DiscoveryRateLimitedError.
 */
@Injectable({ providedIn: 'root' })
export class CameraDiscoveryClient {
  /** Overridable in tests. */
  public fetchImpl: DiscoveryFetch = (url, init) => fetch(url, init);

  async scan(pluginBaseUrl: string | null): Promise<ICameraCandidate[]> {
    const url = buildDiscoverUrl(pluginBaseUrl);
    if (!url) {
      throw new Error('Camera discovery is unavailable');
    }
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (res.status === 429) {
      throw new DiscoveryRateLimitedError(Number(res.headers?.get?.('Retry-After')) || 0);
    }
    if (!res.ok) {
      throw new Error(`Camera discovery failed (${res.status})`);
    }
    const body = (await res.json()) as { cameras?: unknown };
    return Array.isArray(body?.cameras) ? (body.cameras as ICameraCandidate[]) : [];
  }
}

function buildDiscoverUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return null;
  }
  const dir = base.href.endsWith('/') ? base.href : `${base.href}/`;
  return new URL('cameras/discover', dir).href;
}
