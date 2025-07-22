import { ITheme } from "../services/app-service";

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
  return themePalette[color];
}
