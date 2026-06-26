import { Injectable } from '@angular/core';
import type { ICameraSource } from './camera-record.util';

/** Minimal fetch signature so the client is testable without the real network. */
export type ProbeFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** A camera connection test request: the structured source plus optional write-only credentials. */
export interface ICameraProbeRequest {
  source: ICameraSource;
  username?: string;
  password?: string;
}

/** The plugin's verdict for a connection test. */
export interface ICameraProbeResult {
  ok: boolean;
  codec?: string;
  width?: number;
  height?: number;
  message: string;
}

/**
 * Tests a camera connection through the sk-video plugin (`POST /plugins/sk-video/cameras/test`) before
 * it is saved. The plugin probes the camera and reports whether it answers and what it's sending.
 */
@Injectable({ providedIn: 'root' })
export class CameraProbeClient {
  /** Overridable in tests. */
  public fetchImpl: ProbeFetch = (url, init) => fetch(url, init);

  async test(pluginBaseUrl: string | null, request: ICameraProbeRequest): Promise<ICameraProbeResult> {
    const url = buildTestUrl(pluginBaseUrl);
    if (!url) {
      throw new Error('The SK Video plugin is unavailable');
    }
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    // The endpoint returns a result object for every outcome (reachable, blocked, invalid, not-started).
    const body = (await res.json().catch(() => null)) as ICameraProbeResult | null;
    if (body && typeof body.ok === 'boolean') {
      return body;
    }
    return { ok: false, message: 'Could not test the connection.' };
  }
}

function buildTestUrl(baseUrl: string | null | undefined): string | null {
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
  return new URL('cameras/test', dir).href;
}
