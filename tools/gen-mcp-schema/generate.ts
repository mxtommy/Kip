/**
 * Generator for the KIP dashboard schema artifact.
 *
 * Reads KIP source statically (never executes Angular components) and produces a
 * JSON description of the widget catalog and design system for the kip-mcp-server.
 */
import * as path from 'node:path';
import * as ts from 'typescript';
import { findArrayLiteral, literalToValue, parseSourceFile } from './ast';
import type {
  GenerateOptions,
  WidgetCatalogEntry,
  WidgetCategory,
  WidgetSchemaEntry,
} from './types';

const WIDGET_SERVICE = 'src/app/core/services/widget.service.ts';
const WIDGET_CATEGORIES: ReadonlySet<string> = new Set<WidgetCategory>([
  'Core',
  'Gauge',
  'Component',
  'Racing',
]);

/**
 * Extracts KIP's widget catalog (`_widgetDefinition`) from widget.service.ts.
 *
 * Only the active (non-commented-out) widget definitions are returned, sorted by
 * selector so the generated artifact diffs stay localized when widgets change.
 */
export function extractWidgetCatalog(opts: GenerateOptions): WidgetCatalogEntry[] {
  const file = path.join(opts.projectRoot, WIDGET_SERVICE);
  const sourceFile = parseSourceFile(file);
  const array = findArrayLiteral(sourceFile, '_widgetDefinition');

  const entries = array.elements.map((element) => {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error(`Expected a widget definition object literal in ${file}`);
    }
    return toCatalogEntry(literalToValue(element) as Record<string, unknown>, file);
  });

  entries.sort((a, b) => a.selector.localeCompare(b.selector));
  return entries;
}

/**
 * Extracts the full widget schema for every catalog widget: the catalog entry
 * plus its DEFAULT_CONFIG, structural binding kind, and path slots.
 *
 * STUB: implemented in the GREEN step.
 */
export function extractWidgetSchemas(_opts: GenerateOptions): WidgetSchemaEntry[] {
  return [];
}

function toCatalogEntry(raw: Record<string, unknown>, file: string): WidgetCatalogEntry {
  const category = requireString(raw, 'category', file);
  if (!WIDGET_CATEGORIES.has(category)) {
    throw new Error(`Unknown widget category "${category}" in ${file}`);
  }

  const entry: WidgetCatalogEntry = {
    name: requireString(raw, 'name', file),
    selector: requireString(raw, 'selector', file),
    componentClassName: requireString(raw, 'componentClassName', file),
    category: category as WidgetCategory,
    description: requireString(raw, 'description', file),
    icon: requireString(raw, 'icon', file),
    minWidth: requireNumber(raw, 'minWidth', file),
    minHeight: requireNumber(raw, 'minHeight', file),
    defaultWidth: requireNumber(raw, 'defaultWidth', file),
    defaultHeight: requireNumber(raw, 'defaultHeight', file),
    // Plugin lists are sets: sort them for stable diffs.
    requiredPlugins: requireStringArray(raw, 'requiredPlugins', file).slice().sort(),
  };

  if (raw.anyOfPlugins !== undefined) {
    entry.anyOfPlugins = requireStringArray(raw, 'anyOfPlugins', file).slice().sort();
  }
  return entry;
}

function requireString(raw: Record<string, unknown>, key: string, file: string): string {
  const value = raw[key];
  if (typeof value !== 'string') {
    throw new Error(`Expected string "${key}" in a widget definition in ${file}, got ${describe(value)}`);
  }
  return value;
}

function requireNumber(raw: Record<string, unknown>, key: string, file: string): number {
  const value = raw[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected number "${key}" in a widget definition in ${file}, got ${describe(value)}`);
  }
  return value;
}

function requireStringArray(raw: Record<string, unknown>, key: string, file: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Expected string[] "${key}" in a widget definition in ${file}, got ${describe(value)}`);
  }
  return value as string[];
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
