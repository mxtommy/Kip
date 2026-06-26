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
  // Intentionally unimplemented — RED commit. Real behaviour lands in the GREEN commit.
  void pluginId;
  void httpServiceUrl;
  void configuredUrl;
  return null;
}
