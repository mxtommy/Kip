/**
 * Generator for the KIP dashboard schema artifact.
 *
 * Reads KIP source statically (never executes Angular components) and produces a
 * JSON description of the widget catalog and design system for the kip-mcp-server.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import {
  findArrayLiteral,
  findImportModuleSpecifier,
  findPropertyInitializer,
  findStaticPropertyInitializer,
  getObjectProperties,
  literalToValue,
  parseSourceFile,
} from './ast';
import type {
  BindingKind,
  DesignSystem,
  GenerateOptions,
  PathSlot,
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

const APP_SERVICE = 'src/app/core/services/app-service.ts';
const UNITS_SERVICE = 'src/app/core/services/units.service.ts';
const DASHBOARD_COMPONENT = 'src/app/core/components/dashboard/dashboard.component.ts';
const ICONS_SVG = 'src/assets/svg/icons.svg';

// KIP applies themes as body CSS classes; the default (dark) theme is the empty
// string. There is no single source literal to read, so these are listed here and
// kept in step with src/styles.scss and src/themes/_m3{dark,light,night}.scss.
const THEME_NAMES: readonly string[] = ['', 'light-theme', 'night-theme'];

/**
 * Extracts KIP's widget catalog (`_widgetDefinition`) from widget.service.ts.
 *
 * Only the active (non-commented-out) widget definitions are returned, sorted by
 * selector so the generated artifact diffs stay localized when widgets change.
 */
export function extractWidgetCatalog(opts: GenerateOptions): WidgetCatalogEntry[] {
  const file = path.join(opts.projectRoot, WIDGET_SERVICE);
  return extractCatalogFromSource(parseSourceFile(file), file);
}

function extractCatalogFromSource(sourceFile: ts.SourceFile, file: string): WidgetCatalogEntry[] {
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
 * plus its DEFAULT_CONFIG (read verbatim), structural binding kind, and the path
 * slots for record-bound widgets. Sorted by selector (inherited from the catalog).
 */
export function extractWidgetSchemas(opts: GenerateOptions): WidgetSchemaEntry[] {
  const serviceFile = path.join(opts.projectRoot, WIDGET_SERVICE);
  const serviceSource = parseSourceFile(serviceFile);
  const serviceDir = path.dirname(serviceFile);
  const catalog = extractCatalogFromSource(serviceSource, serviceFile);

  return catalog.map((entry) => {
    const moduleSpecifier = findImportModuleSpecifier(serviceSource, entry.componentClassName);
    const componentFile = path.resolve(serviceDir, `${moduleSpecifier}.ts`);
    const initializer = findStaticPropertyInitializer(
      parseSourceFile(componentFile),
      entry.componentClassName,
      'DEFAULT_CONFIG',
    );
    if (!ts.isObjectLiteralExpression(initializer)) {
      throw new Error(`DEFAULT_CONFIG of ${entry.componentClassName} is not an object literal`);
    }
    const defaultConfig = literalToValue(initializer) as Record<string, unknown>;
    const bindingKind = deriveBindingKind(defaultConfig);
    const pathSlots = bindingKind === 'paths-record' ? extractPathSlots(defaultConfig) : [];
    return { ...entry, bindingKind, defaultConfig, pathSlots };
  });
}

/** Derives how a widget binds Signal K data from its DEFAULT_CONFIG shape. */
function deriveBindingKind(config: Record<string, unknown>): BindingKind {
  const paths = config.paths;
  if (Array.isArray(paths)) return 'paths-array';
  if (paths !== null && typeof paths === 'object' && Object.keys(paths).length > 0) {
    return 'paths-record';
  }
  if ('datachartPath' in config) return 'datachart';
  return 'none';
}

/** Maps each entry of a record-form `config.paths` to a PathSlot, in source order. */
function extractPathSlots(config: Record<string, unknown>): PathSlot[] {
  const paths = config.paths as Record<string, Record<string, unknown>>;
  return Object.entries(paths).map(([slot, raw]) => ({
    slot,
    description: asStringOrNull(raw.description),
    defaultPath: asStringOrNull(raw.path),
    source: asStringOrNull(raw.source),
    pathType: asStringOrNull(raw.pathType),
    isPathConfigurable: raw.isPathConfigurable === true,
    pathRequired: raw.pathRequired === true,
    defaultConvertUnitTo: asStringOrNull(raw.convertUnitTo),
    expectedSkUnit: asStringOrNull(raw.pathSkUnitsFilter),
    sampleTime: typeof raw.sampleTime === 'number' ? raw.sampleTime : null,
  }));
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Extracts KIP's design system (grid, colour tokens, theme names, dashboard
 * icons and unit groups) from KIP source.
 */
export function extractDesignSystem(opts: GenerateOptions): DesignSystem {
  return {
    grid: extractGrid(opts.projectRoot),
    colors: extractColors(opts.projectRoot),
    themeNames: [...THEME_NAMES],
    icons: extractIcons(opts.projectRoot),
    unitGroups: extractUnitGroups(opts.projectRoot),
  };
}

function extractGrid(root: string): DesignSystem['grid'] {
  const file = path.join(root, DASHBOARD_COMPONENT);
  const initializer = findPropertyInitializer(parseSourceFile(file), 'gridOptions');

  // gridOptions is `signal<NgGridStackOptions>({ ... })`; unwrap the call argument.
  let objectLiteral: ts.ObjectLiteralExpression | undefined;
  if (ts.isCallExpression(initializer) && ts.isObjectLiteralExpression(initializer.arguments[0])) {
    objectLiteral = initializer.arguments[0];
  } else if (ts.isObjectLiteralExpression(initializer)) {
    objectLiteral = initializer;
  }
  if (!objectLiteral) {
    throw new Error(`gridOptions is not signal({...}) or an object literal in ${file}`);
  }

  const props = getObjectProperties(objectLiteral);
  return {
    column: numberProp(props, 'column', file),
    row: numberProp(props, 'row', file),
    margin: numberProp(props, 'margin', file),
    float: booleanProp(props, 'float', file),
    // KIP computes the row height at runtime; it is not in the literal.
    cellHeight: 'auto',
  };
}

function extractColors(root: string): DesignSystem['colors'] {
  const file = path.join(root, APP_SERVICE);
  const raw = literalToValue(findArrayLiteral(parseSourceFile(file), 'configurableThemeColors'));
  const list = raw as Array<{ value: unknown; label: unknown }>;
  return list.map((c) => ({ value: String(c.value), label: String(c.label) }));
}

function extractUnitGroups(root: string): DesignSystem['unitGroups'] {
  const file = path.join(root, UNITS_SERVICE);
  const raw = literalToValue(findArrayLiteral(parseSourceFile(file), '_conversionList'));
  const list = raw as Array<{ group: unknown; units: Array<{ measure: unknown; description: unknown }> }>;
  return list.map((g) => ({
    group: String(g.group),
    measures: g.units.map((u) => ({ measure: String(u.measure), description: String(u.description) })),
  }));
}

function extractIcons(root: string): string[] {
  const svg = fs.readFileSync(path.join(root, ICONS_SVG), 'utf8');
  const ids = new Set<string>();
  const matcher = /id="(dashboard-[^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(svg)) !== null) {
    ids.add(match[1]);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function numberProp(props: Map<string, ts.Expression>, key: string, file: string): number {
  const node = props.get(key);
  if (!node) throw new Error(`Missing "${key}" in grid options in ${file}`);
  const value = literalToValue(node);
  if (typeof value !== 'number') throw new Error(`Expected number "${key}" in ${file}`);
  return value;
}

function booleanProp(props: Map<string, ts.Expression>, key: string, file: string): boolean {
  const node = props.get(key);
  if (!node) throw new Error(`Missing "${key}" in grid options in ${file}`);
  const value = literalToValue(node);
  if (typeof value !== 'boolean') throw new Error(`Expected boolean "${key}" in ${file}`);
  return value;
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
