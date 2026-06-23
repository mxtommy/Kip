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

export interface GenerateOptions {
  /** Absolute path to the KIP repository root. */
  projectRoot: string;
}
