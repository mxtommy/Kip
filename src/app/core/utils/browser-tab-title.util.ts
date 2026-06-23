/**
 * Resolves the browser tab title (document.title) from the user-configured value.
 * Falls back to 'KIP' when the value is empty/whitespace so the tab is never blank (#1055).
 */
export function resolveBrowserTabTitle(value?: string | null): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : 'KIP';
}
