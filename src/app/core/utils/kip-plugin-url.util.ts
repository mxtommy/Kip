/**
 * Strips a trailing slash and any `/signalk[/vN[/api]]` suffix from a URL, leaving the server root
 * (e.g. `http://host:3000/signalk/v1/api/` and `http://host:3000/signalk/` both -> `http://host:3000`).
 */
export function stripToServerRoot(url: string): string {
  const trimmed = url.trim();
  // Split off the authority (scheme + host[:port]) and only strip the /signalk mount from the PATH,
  // so a host literally named "signalk" (e.g. http://signalk behind a reverse proxy) is never
  // mistaken for the /signalk API segment and eaten.
  const match = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(trimmed);
  if (!match) {
    // Relative or non-http input: strip a single trailing /signalk[/vN[/api]] segment defensively.
    return trimmed.replace(/\/$/, '').replace(/\/signalk(\/v[12](\/api)?)?$/, '');
  }
  const origin = match[1];
  const path = (match[2] ?? '')
    .replace(/\/signalk(\/v[12](\/api)?)?\/?$/, '')
    .replace(/\/$/, '');
  return `${origin}${path}`;
}

/**
 * Resolves the base URL of a Signal K plugin's REST API from the connection endpoint.
 *
 * Targets the plugin's crew-reachable `<server>/signalk/v1/api/<id>/` mount, NOT the `/plugins/<id>`
 * alias: signalk-server admin-gates every `/plugins/*` route on a secured server, so the alias would
 * 401/403 ordinary crew (and a native `<img>`, which carries no auth header) even for reads. The
 * `/signalk/v1/api` mount is public for reads and only gates writes on a read-write/admin principal.
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
    return `${stripToServerRoot(configured)}/signalk/v1/api/${pluginId}/`;
  }
  if (!httpServiceUrl) {
    return null;
  }
  return `${stripToServerRoot(httpServiceUrl)}/signalk/v1/api/${pluginId}/`;
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
