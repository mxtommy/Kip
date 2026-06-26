/**
 * Resolves the base URL of a Signal K server plugin (`<server>/plugins/<pluginId>/`) from the
 * active connection endpoint.
 *
 * Generalises the per-plugin logic previously duplicated in `kip-series-api-client.service` and the
 * image-asset client so every plugin client agrees on how the base URL is derived. Pass the plugin
 * id (e.g. `'kip'`, `'sk-video'`); a user-configured Signal K URL takes precedence over the
 * discovered HTTP service endpoint.
 *
 * @param pluginId       the Signal K plugin id (lower-case kebab; e.g. `'sk-video'`)
 * @param httpServiceUrl the server's discovered v1/v2 API URL (e.g. `http://host:3000/signalk/v1/api/`)
 * @param configuredUrl  the user-configured Signal K URL, if any (takes precedence)
 * @returns the plugin base URL ending in `/`, or `null` if it cannot be resolved
 */
export function resolveSignalKPluginBaseUrl(
  pluginId: string,
  httpServiceUrl: string | null | undefined,
  configuredUrl?: string | null
): string | null {
  // Defensive: the id becomes part of a URL path, so reject anything that isn't a plain
  // lower-case kebab id (no empty, spaces, path traversal or upper-case).
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pluginId)) {
    return null;
  }

  // A user-configured Signal K URL wins over the discovered endpoint.
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
