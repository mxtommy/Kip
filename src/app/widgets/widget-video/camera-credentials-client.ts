import { Injectable } from '@angular/core';

/** Minimal fetch signature so the client is testable without the real network. */
export type CredentialsFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Whether a username/password is stored for a camera — presence only, never the values. */
export interface ICredentialPresence {
  hasUsername: boolean;
  hasPassword: boolean;
}

const CAMERA_ID = /^[A-Za-z0-9-]+$/;

/**
 * Sets or clears a camera's stream credentials through the sk-video plugin's write-only endpoint
 * (`/plugins/sk-video/cameras/:id/credentials`). Credentials are stored server-side only and are
 * never read back or placed in the synced widget config.
 */
@Injectable({ providedIn: 'root' })
export class CameraCredentialsClient {
  /** Overridable in tests. */
  public fetchImpl: CredentialsFetch = (url, init) => fetch(url, init);

  async set(
    pluginBaseUrl: string | null,
    cameraId: string,
    credentials: { username?: string; password?: string }
  ): Promise<void> {
    const url = this.urlFor(pluginBaseUrl, cameraId);
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      throw new Error(`Could not save camera credentials (${res.status})`);
    }
  }

  async clear(pluginBaseUrl: string | null, cameraId: string): Promise<void> {
    const url = this.urlFor(pluginBaseUrl, cameraId);
    const res = await this.fetchImpl(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Could not clear camera credentials (${res.status})`);
    }
  }

  /**
   * Reports whether a username/password is stored for the camera — booleans only, never the secret.
   * A missing endpoint (older plugin) or any error is treated as "nothing stored" so the UI degrades
   * gracefully rather than implying credentials when it cannot tell.
   */
  async presence(pluginBaseUrl: string | null, cameraId: string): Promise<ICredentialPresence> {
    const url = this.urlFor(pluginBaseUrl, cameraId);
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      return { hasUsername: false, hasPassword: false };
    }
    const body = (await res.json()) as Partial<ICredentialPresence> | null;
    return { hasUsername: !!body?.hasUsername, hasPassword: !!body?.hasPassword };
  }

  private urlFor(pluginBaseUrl: string | null, cameraId: string): string {
    if (!pluginBaseUrl) {
      throw new Error('Signal K server is not connected');
    }
    if (!CAMERA_ID.test(cameraId)) {
      throw new Error('Invalid camera id');
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
    const dir = base.href.endsWith('/') ? base.href : `${base.href}/`;
    return new URL(`cameras/${cameraId}/credentials`, dir).href;
  }
}
