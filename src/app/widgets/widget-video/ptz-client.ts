import { Injectable } from '@angular/core';
import { buildPtzUrl, clampPtzVector, type IPtzVector, type TPtzPath } from './ptz-command.util';

/** A camera preset the user can recall. */
export interface IPtzPreset {
  token: string;
  name: string;
}

/** Minimal fetch signature so the client is testable without the real network. */
export type PtzFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Talks to the sk-video plugin's PTZ proxy for a saved camera. Velocities are clamped client-side
 * for a responsive UI; the server clamps and validates again (it is authoritative). Every call goes
 * through the same-origin plugin proxy — never the camera directly.
 */
@Injectable({ providedIn: 'root' })
export class PtzClient {
  /** Overridable in tests. */
  public fetchImpl: PtzFetch = (url, init) => fetch(url, init);

  /** Issues a continuous-move command. The gateway auto-stops after a safety timeout. */
  async move(baseUrl: string | null, cameraId: string | null, vector: Partial<IPtzVector>): Promise<void> {
    const clamped = clampPtzVector(vector);
    await this.post(baseUrl, cameraId, 'ptz', clamped);
  }

  /** Stops all motion. */
  async stop(baseUrl: string | null, cameraId: string | null): Promise<void> {
    await this.post(baseUrl, cameraId, 'ptz/stop');
  }

  /** Recalls a preset by its device token. */
  async gotoPreset(baseUrl: string | null, cameraId: string | null, token: string): Promise<void> {
    await this.post(baseUrl, cameraId, 'ptz/preset', { token });
  }

  /** Lists the camera's presets, normalizing the gateway's name→token map into a sorted array. */
  async listPresets(baseUrl: string | null, cameraId: string | null): Promise<IPtzPreset[]> {
    const url = this.urlOrThrow(baseUrl, cameraId, 'ptz/presets');
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`PTZ presets request failed (${res.status})`);
    }
    const body = (await res.json()) as unknown;
    return normalizePresets(body);
  }

  private async post(
    baseUrl: string | null,
    cameraId: string | null,
    path: TPtzPath,
    body?: unknown
  ): Promise<void> {
    const url = this.urlOrThrow(baseUrl, cameraId, path);
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {})
    });
    if (!res.ok) {
      throw new Error(`PTZ command failed (${res.status})`);
    }
  }

  private urlOrThrow(baseUrl: string | null, cameraId: string | null, path: TPtzPath): string {
    const url = buildPtzUrl(baseUrl, cameraId, path);
    if (!url) {
      throw new Error('PTZ is unavailable for this camera');
    }
    return url;
  }
}

/** Accepts the gateway's `{ name: token }` map (onvif) or an array of presets. */
function normalizePresets(body: unknown): IPtzPreset[] {
  if (Array.isArray(body)) {
    return body
      .map((p) => p as Partial<IPtzPreset>)
      .filter((p): p is IPtzPreset => typeof p?.token === 'string')
      .map((p) => ({ token: p.token, name: p.name || p.token }));
  }
  if (body && typeof body === 'object') {
    return Object.entries(body as Record<string, unknown>)
      .filter(([, token]) => typeof token === 'string')
      .map(([name, token]) => ({ token: token as string, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}
