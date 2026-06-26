const FREEBOARD_SK_PATH = '/@signalk/freeboard-sk/';

/**
 * Builds the embedded Freeboard-SK iframe URL.
 *
 * In cookie mode the iframe must load from the origin KIP is served from (proxy mode leaves the
 * configured server URL cross-origin) and carry no token, so the same-origin session cookie
 * authenticates it. In token mode it loads from the configured server URL and appends the JWT as a
 * query param when one is present.
 */
export function buildFreeboardSkUrl(params: {
  cookieMode: boolean;
  appOrigin: string;
  serverUrl: string;
  token?: string | null;
}): string {
  if (params.cookieMode) {
    return `${params.appOrigin}${FREEBOARD_SK_PATH}`;
  }
  return params.token
    ? `${params.serverUrl}${FREEBOARD_SK_PATH}?token=${params.token}`
    : `${params.serverUrl}${FREEBOARD_SK_PATH}`;
}
