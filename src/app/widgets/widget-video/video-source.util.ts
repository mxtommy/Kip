import type { IVideoWidgetConfig } from '../../core/interfaces/widgets-interface';

/**
 * Resolves the playable URL for a Video widget configuration, or `null` when there is nothing safe
 * to play. Only the `url` source is supported today; other source kinds resolve to `null` until
 * their feature lands.
 *
 * The returned URL is validated to be `http:`/`https:` (relative URLs are resolved against `origin`)
 * so it is safe to bind to a `<video [src]>`; `javascript:`, `data:`, `blob:` and `file:` are rejected.
 *
 * @param video  the widget's video configuration
 * @param origin the page origin used to resolve relative URLs (e.g. `window.location.origin`)
 */
export function resolveVideoSourceUrl(
  video: IVideoWidgetConfig | null | undefined,
  origin: string
): string | null {
  if (!video) {
    return null;
  }

  // Only the direct-URL source is wired up today.
  const kind = video.sourceKind ?? 'url';
  if (kind !== 'url') {
    return null;
  }

  const raw = video.url?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw, origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
