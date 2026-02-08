export interface SvgIconColors {
  fill: string;
  stroke: string;
}

export const DEFAULT_SVG_ICON_COLORS: SvgIconColors = {
  fill: '#ffd200',
  stroke: '#111111'
};

export function applySvgIconColors(svg: string, colors: SvgIconColors): string {
  return svg
    .replace(/--icon-fill:[^;]+/g, `--icon-fill:${colors.fill}`)
    .replace(/--icon-stroke:[^;]+/g, `--icon-stroke:${colors.stroke}`);
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

/**
 * Build icon options for libraries like OpenLayers using a recolored SVG data URL.
 *
 * Color formats: any valid CSS color string (hex, rgb/rgba, hsl/hsla, hwb, lab/lch, color(), named).
 *
 * Usage:
 * ```ts
 * import buoySvg from 'src/assets/svg/marks/buoy-mark.svg?raw';
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
