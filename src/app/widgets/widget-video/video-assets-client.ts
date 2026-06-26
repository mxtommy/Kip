import { Injectable } from '@angular/core';

/** Metadata for a video uploaded to the Signal K server (mirrors the sk-video plugin). */
export interface IVideoAsset {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: number;
}

/** Minimal fetch signature so the client is testable without the real network. */
export type AssetsFetch = (url: string, init?: RequestInit) => Promise<Response>;

const ASSET_ID = /^[A-Za-z0-9-]+$/;

/** Thrown for an upload the server refuses (too large or not a supported video). */
export class VideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoUploadError';
  }
}

/**
 * Lists, uploads, plays and deletes videos stored by the sk-video plugin
 * (`/plugins/sk-video/videos`). Playback is same-origin (served by the plugin with HTTP Range), so
 * the browser never reaches the camera or go2rtc directly.
 */
@Injectable({ providedIn: 'root' })
export class VideoAssetsClient {
  /** Overridable in tests. */
  public fetchImpl: AssetsFetch = (url, init) => fetch(url, init);

  async list(pluginBaseUrl: string | null): Promise<IVideoAsset[]> {
    const url = this.collectionUrl(pluginBaseUrl);
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Could not load videos (${res.status})`);
    }
    const body = (await res.json()) as { videos?: unknown };
    return Array.isArray(body?.videos) ? (body.videos as IVideoAsset[]) : [];
  }

  /** Uploads a file; the server validates it by content and enforces a quota. */
  async upload(pluginBaseUrl: string | null, file: File): Promise<IVideoAsset> {
    const url = this.collectionUrl(pluginBaseUrl);
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name)
      },
      body: file
    });
    if (res.status === 413) {
      throw new VideoUploadError('That file is too large or storage is full.');
    }
    if (res.status === 415) {
      throw new VideoUploadError('That file is not a supported video (use MP4, WebM or MOV).');
    }
    if (!res.ok) {
      throw new VideoUploadError(`Upload failed (${res.status}).`);
    }
    return (await res.json()) as IVideoAsset;
  }

  async remove(pluginBaseUrl: string | null, id: string): Promise<void> {
    const url = this.itemUrl(pluginBaseUrl, id);
    const res = await this.fetchImpl(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Could not delete video (${res.status})`);
    }
  }

  /** Same-origin playback URL for a stored video, or null if the inputs are unsafe. */
  playbackUrl(pluginBaseUrl: string | null, id: string | null | undefined): string | null {
    if (!id || !ASSET_ID.test(id)) {
      return null;
    }
    try {
      return this.itemUrl(pluginBaseUrl, id);
    } catch {
      return null;
    }
  }

  private collectionUrl(pluginBaseUrl: string | null): string {
    const dir = this.baseDir(pluginBaseUrl);
    return new URL('videos', dir).href;
  }

  private itemUrl(pluginBaseUrl: string | null, id: string): string {
    if (!ASSET_ID.test(id)) {
      throw new Error('Invalid video id');
    }
    const dir = this.baseDir(pluginBaseUrl);
    return new URL(`videos/${id}`, dir).href;
  }

  private baseDir(pluginBaseUrl: string | null): string {
    if (!pluginBaseUrl) {
      throw new Error('Signal K server is not connected');
    }
    let base: URL;
    try {
      base = new URL(pluginBaseUrl);
    } catch {
      throw new Error('Invalid server URL');
    }
    if (base.protocol !== 'http:' && base.protocol !== 'https:') {
      throw new Error('Invalid server URL');
    }
    return base.href.endsWith('/') ? base.href : `${base.href}/`;
  }
}
