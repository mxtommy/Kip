import { ITheme } from "../services/app-service";
import { States, TState } from '../interfaces/signalk-interfaces';

/**
 * Returns a set of color values (main, dim, and dimmer) from the theme palette
 * based on the provided color key.
 *
 * @param {string} color - The color key to retrieve from the theme palette.
 *   Supported keys: "contrast", "blue", "green", "pink", "orange", "purple", "yellow", "grey".
 * @param {ITheme} theme - The KIP theme object containing color definitions. ie.: this.theme() from a widget.
 * @returns {{ color: string, dim: string, dimmer: string }} An object with the main KIP theme color hex value,
 *   a dimmed version, and a dimmer version for the specified color key.
 *
 * palette = { color: '#2196f3', dim: '#90caf9', dimmer: '#e3f2fd' }
 *
 * @example
 * ```typescript
 * // As part of a widget theme signal object. Get the dim value for blue color::
 * const hexColor = getColors('blue', this.theme()).dim;
 * // or get the widget config's primary color hex value:
 * const hexColor = getColors(this.widgetProperties.config.color, this.theme()).color;
 * ```
 */
export function getColors(color: string, theme: ITheme): { color: string; dim: string; dimmer: string } {
  const themePalette = {
    "contrast": { color: theme.contrast, dim: theme.contrastDim, dimmer: theme.contrastDimmer },
    "blue": { color: theme.blue, dim: theme.blueDim, dimmer: theme.blueDimmer },
    "green": { color: theme.green, dim: theme.greenDim, dimmer: theme.greenDimmer },
    "pink": { color: theme.pink, dim: theme.pinkDim, dimmer: theme.pinkDimmer },
    "orange": { color: theme.orange, dim: theme.orangeDim, dimmer: theme.orangeDimmer },
    "purple": { color: theme.purple, dim: theme.purpleDim, dimmer: theme.purpleDimmer },
    "yellow": { color: theme.yellow, dim: theme.yellowDim, dimmer: theme.yellowDimmer },
    "grey": { color: theme.grey, dim: theme.greyDim, dimmer: theme.greyDimmer }
  };
  type ThemePaletteKey = keyof typeof themePalette;
  const paletteKey: ThemePaletteKey = color in themePalette ? (color as ThemePaletteKey) : "contrast";

  return themePalette[paletteKey];
}

/**
 * Maps a SignalK state to a KIP theme color, respecting zone-aware semantics.
 *
 * Resolves state-based colors (Nominal, Alarm, Warn, Alert) from the theme.
 * Returns a fallback color when:
 * - `ignoreZones` flag is true (zones disabled in widget config)
 * - `state` is null or undefined (no state data available)
 * - `theme` is null (theme not yet loaded)
 *
 * Use this for UI elements that should reflect Signal K alarm zones
 * (e.g., battery charge bar color, power output text color).
 *
 * @param {TState | null | undefined} state - The SignalK state (e.g., States.Warn, States.Alarm).
 *   Passed as-is; null/undefined treated as "no state info available".
 * @param {string} defaultColor - Fallback color hex from theme (e.g. 'getColors('blue', theme).color') or CSS variable (e.g., 'var(--kip-contrast-color)').
 *   Returned when state is not available or zones are ignored.
 * @param {ITheme | null} theme - The KIP theme object containing zone colors (zoneNominal, zoneAlarm, etc.).
 *   Can be null if theme loads asynchronously; returns defaultColor in that case.
 * @param {boolean} ignoreZones - If true, skip zone mapping and return defaultColor.
 *   Typically set from widget config `ignoreZones` option.
 * @returns {string} A hex color or CSS variable string ready for SVG/CSS fill/stroke attributes.
 *
 * @example
 * ```typescript
 * // In a widget computed signal
 * protected readonly chargeBarColor = computed(() => {
 *   const pathData = this.path.data();
 *   const theme = this.theme();
 *   const cfg = this.runtime.options();
 *   return resolveZoneAwareColor(
 *     pathData.state,
 *     getColors(cfg.color, theme).dim,
 *     theme,
 *     cfg.ignoreZones
 *   );
 * });
 * ```
 */
export function resolveZoneAwareColor(state: TState | null | undefined, defaultColor: string, theme: ITheme | null, ignoreZones: boolean): string {
  if (ignoreZones) return defaultColor;
  if (!state) return defaultColor;
  if (!theme) return defaultColor;

  switch (state) {
    case States.Nominal:
      return theme.zoneNominal;
    case States.Alarm:
      return theme.zoneAlarm;
    case States.Warn:
      return theme.zoneWarn;
    case States.Alert:
      return theme.zoneAlert;
    default:
      return defaultColor;
  }
}
