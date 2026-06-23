/**
 * Generator for the KIP dashboard schema artifact.
 *
 * Reads KIP source statically (never executes Angular components) and produces a
 * JSON description of the widget catalog and design system for the kip-mcp-server.
 *
 * STUB: the extraction is implemented in the next (GREEN) step. For now the
 * functions return empty results so the failing tests describe the intended
 * behavior.
 */
import type { GenerateOptions, WidgetCatalogEntry } from './types';

/**
 * Extracts KIP's widget catalog (`_widgetDefinition`) from widget.service.ts.
 *
 * Only the active (non-commented-out) widget definitions are returned.
 */
export function extractWidgetCatalog(_opts: GenerateOptions): WidgetCatalogEntry[] {
  // TODO(GREEN): parse src/app/core/services/widget.service.ts with ts-morph.
  return [];
}
