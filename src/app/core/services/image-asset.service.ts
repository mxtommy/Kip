import { DestroyRef, Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { SignalKConnectionService } from './signalk-connection.service';
import { resolveKipPluginBaseUrl, snapImageWidth } from '../utils/kip-plugin-url.util';

export interface IImageAsset {
  id: string;
  name: string;
  format: string;
  width: number | null;
  height: number | null;
  bytes: number;
  animated: boolean;
  createdAt: string;
  url?: string;
}

export interface IImageCacheStats {
  bytes: number;
  files: number;
}

/**
 * Client for the KIP image-asset plugin endpoints (upload / list / delete / serve / cache).
 * All requests are auto-authenticated by the app's authentication interceptor (JWT).
 */
@Injectable({ providedIn: 'root' })
export class ImageAssetService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(SignalKConnectionService);
  private readonly destroyRef = inject(DestroyRef);
  private pluginBaseUrl: string | null = null;

  constructor() {
    this.connection.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(endpoint => {
        this.pluginBaseUrl = resolveKipPluginBaseUrl(endpoint?.httpServiceUrl ?? null, this.connection.signalKURL?.url);
      });
  }

  get ready(): boolean {
    return this.pluginBaseUrl !== null;
  }

  private imagesUrl(): string {
    if (!this.pluginBaseUrl) {
      throw new Error('Signal K connection is not ready');
    }
    return `${this.pluginBaseUrl}images`;
  }

  /** Upload a file; emits HttpEvents so callers can show progress. */
  upload(file: File): Observable<HttpEvent<IImageAsset>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<IImageAsset>(this.imagesUrl(), form, { reportProgress: true, observe: 'events' });
  }

  list(): Observable<IImageAsset[]> {
    return this.http.get<IImageAsset[]>(this.imagesUrl());
  }

  delete(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.imagesUrl()}/${encodeURIComponent(id)}`);
  }

  cacheStats(): Observable<IImageCacheStats> {
    return this.http.get<IImageCacheStats>(`${this.imagesUrl()}/cache`);
  }

  purgeCache(): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.imagesUrl()}/cache`);
  }

  /** Build a cache-friendly variant URL matched to a container width (null if unset/not ready). */
  urlFor(id: string | null | undefined, cssWidth?: number | null, devicePixelRatio?: number): string | null {
    if (!id || !this.pluginBaseUrl) {
      return null;
    }
    const dpr = devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    const w = snapImageWidth(cssWidth, dpr);
    return `${this.pluginBaseUrl}images/${encodeURIComponent(id)}?w=${w}`;
  }
}
