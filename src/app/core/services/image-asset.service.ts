import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { SignalKConnectionService } from './signalk-connection.service';
import {
  resolvePluginBaseUrl,
  snapImageWidth,
  DEFAULT_IMAGE_WIDTH_ALLOWLIST
} from '../utils/kip-plugin-url.util';

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
  // Signals so consumers that build URLs inside a reactive computed (e.g. the Image widget) recompute
  // when the base URL resolves or the server-discovered width list arrives — otherwise the first URL
  // would lock to the built-in fallback list.
  private readonly pluginBaseUrl = signal<string | null>(null);
  private readonly widthAllowlist = signal<readonly number[]>(DEFAULT_IMAGE_WIDTH_ALLOWLIST);
  private configFetchedFor: string | null = null;

  constructor() {
    this.connection.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(endpoint => {
        const base = resolvePluginBaseUrl(endpoint?.httpServiceUrl ?? null, this.connection.signalKURL?.url);
        this.pluginBaseUrl.set(base);
        if (base && base !== this.configFetchedFor) {
          this.configFetchedFor = base;
          this.fetchConfig(base);
        }
      });
  }

  /** Discover the plugin's supported variant widths so we don't hard-code a mirror of the server list. */
  private fetchConfig(base: string): void {
    this.http.get<{ widthAllowlist?: number[] }>(`${base}config`).subscribe({
      next: cfg => {
        const widths = (cfg?.widthAllowlist ?? [])
          .filter(w => typeof w === 'number' && w > 0)
          .sort((a, b) => a - b);
        this.widthAllowlist.set(widths.length ? widths : DEFAULT_IMAGE_WIDTH_ALLOWLIST);
      },
      error: () => {
        // Older plugin or unreachable — keep the built-in default.
        this.widthAllowlist.set(DEFAULT_IMAGE_WIDTH_ALLOWLIST);
      }
    });
  }

  get ready(): boolean {
    return this.pluginBaseUrl() !== null;
  }

  private imagesUrl(): string {
    const base = this.pluginBaseUrl();
    if (!base) {
      throw new Error('Signal K connection is not ready');
    }
    return `${base}images`;
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
    const base = this.pluginBaseUrl();
    if (!id || !base) {
      return null;
    }
    const dpr = devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    const w = snapImageWidth(cssWidth, dpr, this.widthAllowlist());
    return `${base}images/${encodeURIComponent(id)}?w=${w}`;
  }
}
