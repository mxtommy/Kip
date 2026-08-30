/**
 * Types for the generated KIP dashboard schema artifact.
 *
 * This artifact is produced by reading KIP's own source (the widget catalog,
 * each widget's DEFAULT_CONFIG, and the design-system constants) and is consumed
 * by the external kip-mcp-server so an AI can design valid KIP dashboards.
 *
 * Keep this in sync with KIP's interfaces. The generator fails loudly when the
 * source no longer matches these expectations.
 */

export type WidgetCategory = 'Core' | 'Gauge' | 'Component' | 'Racing';

/**
 * One entry of KIP's widget catalog (`_widgetDefinition` in widget.service.ts).
 */
export interface WidgetCatalogEntry {
  /** Human-readable name shown in the widget picker. */
  name: string;
  /** Widget type id, e.g. `widget-numeric`. Goes into `widgetProperties.type`. */
  selector: string;
  /** Angular component class that implements the widget. */
  componentClassName: string;
  /** Picker grouping. */
  category: WidgetCategory;
  /** Short description of what the widget does. */
  description: string;
  /** Icon key in KIP's SVG sprite. */
  icon: string;
  /** Minimum grid width in columns (of 24). */
  minWidth: number;
  /** Minimum grid height in rows. */
  minHeight: number;
  /** Default grid width in columns (of 24) when first added. */
  defaultWidth: number;
  /** Default grid height in rows when first added. */
  defaultHeight: number;
  /** Plugins that must ALL be enabled for the widget to work. */
  requiredPlugins: string[];
  /** Plugins where at least one must be enabled, if present. */
  anyOfPlugins?: string[];
}

/**
 * How a widget binds Signal K data, derived structurally from its DEFAULT_CONFIG.
 *
 *  - `paths-record`  config.paths is a keyed object of slots (most widgets).
 *  - `paths-array`   config.paths is an array (switch / zones panels).
 *  - `datachart`     no paths; a single top-level datachartPath (history chart).
 *  - `none`          no path binding (static widgets, or ones configured through a
 *                    special config object such as bms/ais/charger).
 *
 * Plugin/capability gating is described separately (catalog plugin fields), not here.
 */
export type BindingKind = 'paths-record' | 'paths-array' | 'datachart' | 'none';

/**
 * A single data slot of a `paths-record` widget, derived from one entry of
 * DEFAULT_CONFIG.paths. Fields mirror KIP's IWidgetPath.
 */
export interface PathSlot {
  /** The key under config.paths, e.g. `numericPath` or `headingPath`. */
  slot: string;
  /** Slot label shown in KIP's options UI. */
  description: string | null;
  /** The default Signal K path baked into DEFAULT_CONFIG (often null). */
  defaultPath: string | null;
  /** Default source, or null for the server default. */
  source: string | null;
  /** `number` | `string` | `boolean` | `Date` | `multiple` | null. */
  pathType: string | null;
  /** Whether the user (or MCP) may set this slot's path. */
  isPathConfigurable: boolean;
  /** Whether the widget needs this slot bound to work. */
  pathRequired: boolean;
  /** Default unit conversion (convertUnitTo), or null. */
  defaultConvertUnitTo: string | null;
  /** Expected Signal K base unit filter (pathSkUnitsFilter), or null. */
  expectedSkUnit: string | null;
  /** Default subscription throttle in milliseconds, or null. */
  sampleTime: number | null;
}

/**
 * A catalog entry enriched with its DEFAULT_CONFIG, binding kind and path slots —
 * everything the MCP needs to build a valid widget instance.
 */
export interface WidgetSchemaEntry extends WidgetCatalogEntry {
  bindingKind: BindingKind;
  /** The widget's DEFAULT_CONFIG, read verbatim from source. */
  defaultConfig: Record<string, unknown>;
  /** Data slots for `paths-record` widgets; empty for every other binding kind. */
  pathSlots: PathSlot[];
}

/** A named widget colour token (KIP's `configurableThemeColors`). */
export interface ColorToken {
  value: string;
  label: string;
  /** Base (dark-theme) hex for the token, e.g. `#3298ff`, for previews. */
  hex: string;
}

/** One convertible unit within a unit group. */
export interface UnitMeasure {
  measure: string;
  description: string;
}

/** A group of related units (KIP's unit conversion list). */
export interface UnitGroup {
  group: string;
  measures: UnitMeasure[];
}

/** The dashboard grid geometry (GridStack options). */
export interface GridGeometry {
  column: number;
  row: number;
  margin: number;
  float: boolean;
  /** Row height; KIP computes this at runtime, hence `'auto'`. */
  cellHeight: string;
}

/**
 * KIP's design system: everything a dashboard designer needs beyond the widgets
 * themselves — the grid, colour tokens, theme names, dashboard icons and units.
 *
 * Colour tokens and unit groups keep their authored order (the palette and the
 * base-unit-first convention are meaningful); icons are sorted (a plain set).
 */
export interface DesignSystem {
  grid: GridGeometry;
  colors: ColorToken[];
  themeNames: string[];
  icons: string[];
  unitGroups: UnitGroup[];
}

/** Provenance and version stamps for the generated artifact. */
export interface SchemaMeta {
  /** Version of this artifact's own shape. */
  schemaVersion: number;
  /** KIP package version the artifact was generated from. */
  kipVersion: string;
  /** applicationData file version used in the storage URL (`.../kip/{N}/...`). */
  configFileVersion: number;
  /** `app.configVersion` value KIP expects in a saved config body. */
  configVersion: number;
}

/**
 * The complete generated artifact: everything the kip-mcp-server needs to design
 * valid KIP dashboards, read from KIP source and written canonically.
 */
export interface KipDashboardSchema {
  meta: SchemaMeta;
  widgets: WidgetSchemaEntry[];
  designSystem: DesignSystem;
}

export interface GenerateOptions {
  /** Absolute path to the KIP repository root. */
  projectRoot: string;
}
