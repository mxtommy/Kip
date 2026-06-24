/**
 * Resolves the base URL of the KIP Signal K plugin (`<server>/plugins/kip/`) from the connection
 * endpoint, mirroring the logic in kip-series-api-client.service so both clients agree.
 *
 * @param httpServiceUrl the server's v1 API URL (e.g. `http://host:3000/signalk/v1/api/`)
 * @param configuredUrl  the user-configured Signal K URL, if any (takes precedence)
 */
export function resolveKipPluginBaseUrl(httpServiceUrl: string | null | undefined, configuredUrl?: string | null): string | null {
  const configured = configuredUrl?.trim();
  if (configured) {
    const base = configured.endsWith('/') ? configured.slice(0, -1) : configured;
    return `${base}/plugins/kip/`;
  }
  if (!httpServiceUrl) {
    return null;
  }
  const normalized = httpServiceUrl.endsWith('/') ? httpServiceUrl.slice(0, -1) : httpServiceUrl;
  const root = normalized
    .replace(/\/signalk\/v2\/api$/, '')
    .replace(/\/signalk\/v1\/api$/, '')
    .replace(/\/signalk\/v2$/, '')
    .replace(/\/signalk\/v1$/, '')
    .replace(/\/signalk$/, '');
  return `${root}/plugins/kip/`;
}

/**
 * Allowed image variant widths. Must match the server's allow-list so the client requests stable,
 * cache-friendly URLs (the server snaps too, but matching avoids browser-cache misses).
 */
export const IMAGE_WIDTH_ALLOWLIST: readonly number[] = [160, 320, 640, 960, 1280, 1920, 2560];

/** Snap a CSS width (times device pixel ratio) up to the nearest allow-listed variant width. */
export function snapImageWidth(cssWidth?: number | null, devicePixelRatio = 1): number {
  const dpr = devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const target = cssWidth && cssWidth > 0 ? cssWidth * dpr : 0;
  const max = IMAGE_WIDTH_ALLOWLIST[IMAGE_WIDTH_ALLOWLIST.length - 1];
  if (!target) {
    return max;
  }
  for (const w of IMAGE_WIDTH_ALLOWLIST) {
    if (w >= target) {
      return w;
    }
  }
  return max;
}
