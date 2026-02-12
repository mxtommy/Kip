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
  auraColor?: string;
  auraOpacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
  sizePx: number;
}

export interface AisIconThemeInput {
  targetKind: AisIconTargetKind;
  targetState: AisIconTargetState;
  isStationary?: boolean;
  collisionRiskRating?: number;
  baseSizePx?: number;
  baseStrokeWidth?: number;
  unconfirmedFill?: string;
  unconfirmedOpacity?: number;
}

export const DEFAULT_SVG_ICON_COLORS: SvgIconColors = {
  fill: '#b1b1b1',
  stroke: '#50505f'
};

const DEFAULT_ICON_SIZE_PX = 24;
const DEFAULT_STROKE_WIDTH = 1.6;
const DEFAULT_UNCONFIRMED_FILL = '#e6e6e6';
const DEFAULT_UNCONFIRMED_OPACITY = 0.15;
const DEFAULT_FILL_OPACITY = 1;
const DEFAULT_STROKE_OPACITY = 1;
export const COLLISION_RISK_HIGH_THRESHOLD = 15000;
export const COLLISION_RISK_LOW_THRESHOLD = 25000;
const AURA_OPACITY = 0.9;
const AURA_SIZE_MULTIPLIER = 1.25;

export function applySvgIconColors(svg: string, colors: SvgIconColors): string {
  return svg
    .replace(/--icon-fill:[^;]+/g, `--icon-fill:${colors.fill}`)
    .replace(/--icon-stroke:[^;]+/g, `--icon-stroke:${colors.stroke}`);
}

export function buildAisIconTheme(input: AisIconThemeInput): AisIconTheme {
  const baseSize = input.baseSizePx
    ?? DEFAULT_ICON_SIZE_PX;
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
  let auraColor: string | undefined;
  let auraOpacity: number | undefined;

  if (!isConfirmed) {
    fill = unconfirmedFill;
    fillOpacity = unconfirmedOpacity;
    strokeOpacity = unconfirmedOpacity;
  }

  if (isConfirmed && input.isStationary) {
    fillOpacity = 0;
  }

  if (input.targetKind === 'moving' && collisionRisk !== 'none') {
    auraColor = collisionRisk === 'high' ? 'red' : 'yellow';
    auraOpacity = AURA_OPACITY;
    return {
      fill,
      stroke,
      auraColor,
      auraOpacity,
      fillOpacity,
      strokeOpacity,
      strokeWidth,
      sizePx: Math.round(baseSize * AURA_SIZE_MULTIPLIER)
    };
  }

  return { fill, stroke, auraColor, auraOpacity, fillOpacity, strokeOpacity, strokeWidth, sizePx };
}

export function applyAisIconTheme(svg: string, theme: AisIconTheme): string {
  const tokens = resolveIconTokens(svg, theme);
  const sized = applySvgRootSize(svg, theme.sizePx);
  const withAura = theme.auraColor ? injectAura(sized) : sized;
  return injectSvgStyle(withAura, buildSvgTokenStyle(tokens));
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
  if (rating < COLLISION_RISK_HIGH_THRESHOLD) return 'high';
  if (rating < COLLISION_RISK_LOW_THRESHOLD) return 'low';
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
    auraColor: resolveToken(theme.auraColor, existing.auraColor, 'transparent'),
    auraOpacity: resolveToken(theme.auraOpacity, existing.auraOpacity, 0),
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
    auraColor: extractCssVar(svg, '--icon-aura-color'),
    auraOpacity: extractCssVarNumber(svg, '--icon-aura-opacity'),
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
  auraColor: string;
  auraOpacity: number;
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
    `--icon-aura-color: ${tokens.auraColor};`,
    `--icon-aura-opacity: ${clampOpacity(tokens.auraOpacity)};`,
    `--icon-stroke-width: ${tokens.strokeWidth};`,
    `--icon-stroke-opacity: ${clampOpacity(tokens.strokeOpacity)};`,
    '}'
  ].join('');
}

function injectAura(svg: string): string {
  if (svg.includes('id="icon-aura"') || svg.includes("id='icon-aura'")) return svg;
  const box = extractViewBox(svg) ?? { minX: 0, minY: 0, width: 24, height: 24 };
  const cx = box.minX + box.width / 2;
  const cy = box.minY + box.height / 2;
  const r = Math.min(box.width, box.height) / 2;

  const defs = [
    '<defs>',
    '<radialGradient id="icon-aura" cx="50%" cy="50%" r="50%">',
    '<stop offset="0%" stop-color="var(--icon-aura-color)" stop-opacity="var(--icon-aura-opacity)" />',
    '<stop offset="100%" stop-color="var(--icon-aura-color)" stop-opacity="0" />',
    '</radialGradient>',
    '</defs>'
  ].join('');

  const circle = `<circle class="icon-aura" cx="${cx}" cy="${cy}" r="${r}" fill="url(#icon-aura)" />`;
  return svg.replace(/<svg[^>]*>/i, match => `${match}${defs}${circle}`);
}

function extractViewBox(svg: string): { minX: number; minY: number; width: number; height: number } | null {
  const match = svg.match(/viewBox="([^"]+)"/i);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map(value => Number(value));
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) return null;
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
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
