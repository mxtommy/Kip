export interface SvgIconColors {
  fill: string;
  stroke: string;
}

export type AisIconTargetKind = 'moving' | 'fixed';
export type AisIconTargetState = 'confirmed' | 'unconfirmed';
export type AisIconCollisionRisk = 'none' | 'low' | 'high';

export interface AisIconTheme {
  fill?: string;
  stroke?: string;
  strokeStyle?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
  sizePx: number;
}

export interface AisIconThemeInput {
  targetKind: AisIconTargetKind;
  targetState: AisIconTargetState;
  collisionRiskRating?: number;
  baseSizePx?: number;
  baseStrokeWidth?: number;
  confirmedFill?: string;
  confirmedStroke?: string;
  unconfirmedFill?: string;
  unconfirmedOpacity?: number;
}

export const DEFAULT_SVG_ICON_COLORS: SvgIconColors = {
  fill: '#ffd200',
  stroke: '#111111'
};

const DEFAULT_MOVING_SIZE_PX = 24;
const DEFAULT_FIXED_SIZE_PX = 28;
const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_UNCONFIRMED_FILL = '#d9d9d9';
const DEFAULT_UNCONFIRMED_OPACITY = 0.5;
const DEFAULT_FILL_OPACITY = 1;
const DEFAULT_STROKE_OPACITY = 1;

export function applySvgIconColors(svg: string, colors: SvgIconColors): string {
  return svg
    .replace(/--icon-fill:[^;]+/g, `--icon-fill:${colors.fill}`)
    .replace(/--icon-stroke:[^;]+/g, `--icon-stroke:${colors.stroke}`);
}

export function buildAisIconTheme(input: AisIconThemeInput): AisIconTheme {
  const baseSize = input.baseSizePx
    ?? (input.targetKind === 'fixed' ? DEFAULT_FIXED_SIZE_PX : DEFAULT_MOVING_SIZE_PX);
  const baseStrokeWidth = input.baseStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const unconfirmedFill = input.unconfirmedFill ?? DEFAULT_UNCONFIRMED_FILL;
  const unconfirmedOpacity = input.unconfirmedOpacity ?? DEFAULT_UNCONFIRMED_OPACITY;

  const isConfirmed = input.targetState === 'confirmed';
  const collisionRisk = isConfirmed ? resolveCollisionRiskFactor(input.collisionRiskRating) : 'none';
  const sizePx = baseSize;

  let fill: string | undefined;
  let stroke: string | undefined;
  let fillOpacity: number | undefined;
  let strokeOpacity: number | undefined;
  let strokeWidth: number | undefined;

  if (!isConfirmed) {
    fill = unconfirmedFill;
    fillOpacity = unconfirmedOpacity;
  }

  if (input.targetKind === 'moving' && collisionRisk !== 'none') {
    stroke = collisionRisk === 'high' ? 'red' : 'yellow';
    strokeWidth = baseStrokeWidth * 2;
    return {
      fill,
      stroke,
      fillOpacity,
      strokeOpacity,
      strokeWidth,
      sizePx: Math.round(baseSize * 1.25)
    };
  }

  return { fill, stroke, fillOpacity, strokeOpacity, strokeWidth, sizePx };
}

export function applyAisIconTheme(svg: string, theme: AisIconTheme): string {
  const tokens = resolveIconTokens(svg, theme);
  const sized = applySvgRootSize(svg, theme.sizePx);
  return injectSvgStyle(sized, buildSvgTokenStyle(tokens));
}

export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%0D/g, '');
  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

export function buildColoredSvgDataUrl(svg: string, colors: SvgIconColors): string {
  return svgToDataUrl(applySvgIconColors(svg, colors));
}

export function buildThemedSvgDataUrl(svg: string, theme: AisIconTheme): string {
  return svgToDataUrl(applyAisIconTheme(svg, theme));
}

/**
 * Build icon options for libraries like OpenLayers using a recolored SVG data URL.
 *
 * Color formats: any valid CSS color string (hex, rgb/rgba, hsl/hsla, hwb, lab/lch, color(), named).
 *
 * Usage:
 * ```ts
 * import buoySvg from '../../../assets/svg/marks/buoy-mark.svg?raw';
 * import { buildSvgIconOptions } from 'src/app/core/utils/ais-svg-icon.util';
 *
 * const options = buildSvgIconOptions(buoySvg, { fill: '#ffd200', stroke: '#111111' });
 * // new Icon(options)
 * ```
 */
export function buildSvgIconOptions(svg: string, colors: SvgIconColors) {
  return {
    src: buildColoredSvgDataUrl(svg, colors),
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    scale: 1
  } as const;
}

export function buildThemedSvgIconOptions(svg: string, theme: AisIconTheme) {
  return {
    src: buildThemedSvgDataUrl(svg, theme),
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    scale: 1
  } as const;
}

function resolveCollisionRiskFactor(rating?: number): AisIconCollisionRisk {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return 'none';
  if (rating < 15000) return 'high';
  if (rating < 25000) return 'low';
  return 'none';
}

function applySvgRootSize(svg: string, sizePx: number): string {
  const size = `${sizePx}px`;
  if (/<svg[^>]*\bwidth=/.test(svg)) {
    svg = svg.replace(/\bwidth="[^"]*"/i, `width="${size}"`);
  } else {
    svg = svg.replace(/<svg\b/i, `<svg width="${size}"`);
  }
  if (/<svg[^>]*\bheight=/.test(svg)) {
    svg = svg.replace(/\bheight="[^"]*"/i, `height="${size}"`);
  } else {
    svg = svg.replace(/<svg\b/i, `<svg height="${size}"`);
  }
  return svg;
}

function resolveIconTokens(svg: string, theme: AisIconTheme) {
  // Token precedence: theme override -> SVG token -> util default.
  const existing = extractIconTokens(svg);
  return {
    fill: resolveToken(theme.fill, existing.fill, DEFAULT_SVG_ICON_COLORS.fill),
    stroke: resolveToken(theme.stroke, existing.stroke, DEFAULT_SVG_ICON_COLORS.stroke),
    strokeDasharray: resolveToken(theme.strokeStyle, existing.strokeStyle, 'solid'),
    strokeWidth: resolveToken(theme.strokeWidth, existing.strokeWidth, DEFAULT_STROKE_WIDTH),
    fillOpacity: resolveToken(theme.fillOpacity, existing.fillOpacity, DEFAULT_FILL_OPACITY),
    strokeOpacity: resolveToken(theme.strokeOpacity, existing.strokeOpacity, DEFAULT_STROKE_OPACITY)
  };
}

function extractIconTokens(svg: string) {
  return {
    fill: extractCssVar(svg, '--icon-fill'),
    stroke: extractCssVar(svg, '--icon-stroke'),
    strokeStyle: extractCssVar(svg, '--icon-stroke-dasharray'),
    strokeWidth: extractCssVarNumber(svg, '--icon-stroke-width'),
    fillOpacity: extractCssVarNumber(svg, '--icon-fill-opacity'),
    strokeOpacity: extractCssVarNumber(svg, '--icon-stroke-opacity')
  };
}

function extractCssVar(svg: string, name: string): string | undefined {
  const match = svg.match(new RegExp(`${escapeRegExp(name)}:\\s*([^;]+);`, 'i'));
  return match ? match[1].trim() : undefined;
}

function extractCssVarNumber(svg: string, name: string): number | undefined {
  const value = extractCssVar(svg, name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveToken<T>(override: T | undefined, existing: T | undefined, fallback: T): T {
  if (override !== undefined) return override;
  if (existing !== undefined) return existing;
  return fallback;
}

function buildSvgTokenStyle(tokens: {
  fill: string;
  stroke: string;
  strokeDasharray: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
}): string {
  return [
    ':root {',
    `--icon-fill: ${tokens.fill};`,
    `--icon-fill-opacity: ${clampOpacity(tokens.fillOpacity)};`,
    `--icon-stroke: ${tokens.stroke};`,
    `--icon-stroke-dasharray: ${tokens.strokeDasharray};`,
    `--icon-stroke-width: ${tokens.strokeWidth};`,
    `--icon-stroke-opacity: ${clampOpacity(tokens.strokeOpacity)};`,
    '}'
  ].join('');
}

function injectSvgStyle(svg: string, css: string): string {
  const styleMatch = svg.match(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i);
  if (styleMatch) {
    const [, open, , close] = styleMatch;
    return svg.replace(styleMatch[0], `${open}${css}${close}`);
  }
  return svg.replace(/<svg[^>]*>/i, match => `${match}<style>${css}</style>`);
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}
