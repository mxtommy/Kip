import { ISkZone, States } from "../interfaces/signalk-interfaces";
import { IDataHighlight } from "../interfaces/widgets-interface";
import { ITheme } from "../services/app-service";
import { UnitsService } from "../services/units.service";

/**
 * Generates an array of highlight segments for a gauge, based on defined zones, theme colors,
 * and unit conversions. Each highlight represents a colored region on the gauge corresponding
 * to a zone state (e.g., nominal, alert, warn, alarm, emergency). Normal has no specific color
 * and is never displayed. It's the default state.
 *
 * Zones are sorted by their lower bound. Each zone is converted to the target unit, clamped to the
 * gauge's display range, and assigned a color from the theme based on its state. Zones that fall
 * completely outside the gauge range are skipped. If a zone extends beyond the upper scale, it is
 * truncated at the upper scale and no further zones are processed.
 *
 * @param {ISkZone[]} zones - Array of zone definitions, each with lower/upper bounds and a state.
 * @param {ITheme} theme - The current theme object, providing color values for each state.
 * @param {string} convertUnitTo - The unit to which zone bounds should be converted. Zones range definition are always in base units.
 * @param {UnitsService} unitsService - Service used to convert zone bounds to the target unit.
 * @param {number} lowerScale - The minimum value of the gauge's display range.
 * @param {number} upperScale - The maximum value of the gauge's display range.
 * @param {boolean} [invert=false] When true, the gauge's scale is inverted (lowerScale > upperScale).
 * The function normalizes internally so returned highlight ranges are always in ascending numeric order.
 * @returns {IDataHighlight[]} Array of highlight objects, each with a from, to, and color property.
 *
 * @example
 * const highlights = getHighlights(
 *   zones,
 *   this.theme(),
 *   'V',
 *   this.unitsService,
 *   0,
 *   15
 * );
 * // highlights: [{from: 0, to: 5, color: '#00ff00'}, ...]
 */
export function getHighlights(zones: ISkZone[], theme: ITheme, convertUnitTo: string, unitsService: UnitsService, lowerScale: number, upperScale: number, invert = false): IDataHighlight[] {
  let gaugeZonesHighlight: IDataHighlight[] = [];
  // Sort zones based on lower value
  const sortedZones = [...zones].sort((a, b) => a.lower - b.lower);
  for (const zone of sortedZones) {
    let lower: number = null;
    let upper: number = null;

    let color: string;
    switch (zone.state) {
      case States.Emergency:
        color = theme.zoneEmergency;
        break;
      case States.Alarm:
        color = theme.zoneAlarm;
        break;
      case States.Warn:
        color = theme.zoneWarn;
        break;
      case States.Alert:
        color = theme.zoneAlert;
        break;
      case States.Nominal:
        color = theme.zoneNominal;
        break;
      default:
        color = "rgba(0,0,0,0)";
    }

    lower = unitsService.convertToUnit(convertUnitTo, zone.lower);
    upper = unitsService.convertToUnit(convertUnitTo, zone.upper);

    // Skip zones that are completely outside the gauge range
    if (upper < lowerScale || lower > upperScale) {
      continue;
    }

    // If lower or upper are null, set them to displayScale min or max
    lower = lower !== null ? lower : lowerScale;
    upper = upper !== null ? upper : upperScale;

    // Ensure lower does not go below min
    lower = Math.max(lower, lowerScale);

    // Ensure upper does not exceed max
    if (upper > upperScale) {
      upper = upperScale;
      gaugeZonesHighlight.push({from: lower, to: upper, color: color});
      break;
    }

    gaugeZonesHighlight.push({from: lower, to: upper, color: color});
  };
  // If the scale is inverted, swap from/to for each highlight segment
  if (invert) {
    gaugeZonesHighlight = gaugeZonesHighlight.map(h => ({ from: upperScale - h.to, to: upperScale - h.from, color: h.color }));
  }

  return gaugeZonesHighlight;
}
