import { Injectable } from '@angular/core';
import type { ICameraRecord } from './camera-record.util';

/** A saved camera plus its resource id. */
export interface ISavedCamera extends ICameraRecord {
  id: string;
}

/** Minimal fetch signature so the client is testable without the real network. */
export type ResourceFetch = (url: string, init?: RequestInit) => Promise<Response>;

const CAMERA_ID = /^[A-Za-z0-9-]+$/;

/**
 * Reads and writes camera definitions through the Signal K v2 resources API
 * (`/signalk/v2/api/resources/cameras`), which the sk-video plugin serves. Credentials are never
 * part of a camera resource (they are set through the plugin's write-only credentials endpoint).
 */
@Injectable({ providedIn: 'root' })
export class CamerasResourceClient {
  /** Overridable in tests. */
  public fetchImpl: ResourceFetch = (url, init) => fetch(url, init);

  /** Lists saved cameras, normalizing the resource map into an array sorted by name. */
  async list(v2BaseUrl: string | null): Promise<ISavedCamera[]> {
    const url = this.collectionUrl(v2BaseUrl);
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (res.status === 404) {
      return []; // no cameras registered yet
    }
    if (!res.ok) {
      throw new Error(`Could not load cameras (${res.status})`);
    }
    const body = (await res.json()) as Record<string, ICameraRecord> | null;
    if (!body || typeof body !== 'object') {
      return [];
    }
    return Object.entries(body)
      .filter(([id, cam]) => CAMERA_ID.test(id) && cam && typeof cam === 'object')
      .map(([id, cam]) => ({ id, ...cam }))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }

  /** Creates or updates a camera resource. */
  async save(v2BaseUrl: string | null, id: string, record: ICameraRecord): Promise<void> {
    const url = this.itemUrl(v2BaseUrl, id);
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      throw new Error(`Could not save camera (${res.status})`);
    }
  }

  /** Deletes a camera resource. */
  async remove(v2BaseUrl: string | null, id: string): Promise<void> {
    const url = this.itemUrl(v2BaseUrl, id);
    const res = await this.fetchImpl(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Could not delete camera (${res.status})`);
    }
  }

  private collectionUrl(v2BaseUrl: string | null): string {
    const base = this.baseOrThrow(v2BaseUrl);
    return `${base}/resources/cameras`;
  }

  private itemUrl(v2BaseUrl: string | null, id: string): string {
    if (!CAMERA_ID.test(id)) {
      throw new Error('Invalid camera id');
    }
    return `${this.collectionUrl(v2BaseUrl)}/${id}`;
  }

  private baseOrThrow(v2BaseUrl: string | null): string {
    const base = v2BaseUrl?.trim();
    if (!base) {
      throw new Error('Signal K server is not connected');
    }
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }
}
