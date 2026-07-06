/**
 * Resolves the base URL of a Signal K plugin (`<server>/plugins/<id>/`) from the connection
 * endpoint, mirroring the logic in kip-series-api-client.service so both clients agree.
 *
 * @param httpServiceUrl the server's v1 API URL (e.g. `http://host:3000/signalk/v1/api/`)
 * @param configuredUrl  the user-configured Signal K URL, if any (takes precedence)
 * @param pluginId       the Signal K plugin id (defaults to the image plugin, `sk-image`)
 */
export function resolvePluginBaseUrl(
  httpServiceUrl: string | null | undefined,
  configuredUrl?: string | null,
  pluginId = 'sk-image'
): string | null {
  const configured = configuredUrl?.trim();
  if (configured) {
    const base = configured.endsWith('/') ? configured.slice(0, -1) : configured;
    return `${base}/plugins/${pluginId}/`;
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
  return `${root}/plugins/${pluginId}/`;
}

/**
 * Fallback image variant widths, used until the plugin's `GET /config` advertises its own list.
 * Matching the server keeps client requests stable and cache-friendly.
 */
export const DEFAULT_IMAGE_WIDTH_ALLOWLIST: readonly number[] = [160, 320, 640, 960, 1280, 1920, 2560];

/** Snap a CSS width (times device pixel ratio) up to the nearest allow-listed variant width. */
export function snapImageWidth(
  cssWidth?: number | null,
  devicePixelRatio = 1,
  allowlist: readonly number[] = DEFAULT_IMAGE_WIDTH_ALLOWLIST
): number {
  const list = allowlist.length ? allowlist : DEFAULT_IMAGE_WIDTH_ALLOWLIST;
  const dpr = devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const target = cssWidth && cssWidth > 0 ? cssWidth * dpr : 0;
  const max = list[list.length - 1];
  if (!target) {
    return max;
  }
  for (const w of list) {
    if (w >= target) {
      return w;
    }
  }
  return max;
}
