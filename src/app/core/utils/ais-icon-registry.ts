import atonBasestation from 'src/assets/svg/atons/basestation.svg?raw';
import atonReal from 'src/assets/svg/atons/real-aton.svg?raw';
import atonRealDanger from 'src/assets/svg/atons/real-danger.svg?raw';
import atonRealEast from 'src/assets/svg/atons/real-east.svg?raw';
import atonRealNorth from 'src/assets/svg/atons/real-north.svg?raw';
import atonRealPort from 'src/assets/svg/atons/real-port.svg?raw';
import atonRealSafe from 'src/assets/svg/atons/real-safe.svg?raw';
import atonRealSouth from 'src/assets/svg/atons/real-south.svg?raw';
import atonRealSpecial from 'src/assets/svg/atons/real-special.svg?raw';
import atonRealStarboard from 'src/assets/svg/atons/real-starboard.svg?raw';
import atonRealWest from 'src/assets/svg/atons/real-west.svg?raw';
import atonVirtual from 'src/assets/svg/atons/virtual-aton.svg?raw';
import atonVirtualDanger from 'src/assets/svg/atons/virtual-danger.svg?raw';
import atonVirtualEast from 'src/assets/svg/atons/virtual-east.svg?raw';
import atonVirtualNorth from 'src/assets/svg/atons/virtual-north.svg?raw';
import atonVirtualPort from 'src/assets/svg/atons/virtual-port.svg?raw';
import atonVirtualSafe from 'src/assets/svg/atons/virtual-safe.svg?raw';
import atonVirtualSouth from 'src/assets/svg/atons/virtual-south.svg?raw';
import atonVirtualSpecial from 'src/assets/svg/atons/virtual-special.svg?raw';
import atonVirtualStarboard from 'src/assets/svg/atons/virtual-starboard.svg?raw';
import atonVirtualWest from 'src/assets/svg/atons/virtual-west.svg?raw';
import vesselActive from 'src/assets/svg/vessels/ais_active.svg?raw';
import vesselCargo from 'src/assets/svg/vessels/ais_cargo.svg?raw';
import vesselHighspeed from 'src/assets/svg/vessels/ais_highspeed.svg?raw';
import vesselInactive from 'src/assets/svg/vessels/ais_inactive.svg?raw';
import vesselOther from 'src/assets/svg/vessels/ais_other.svg?raw';
import vesselPassenger from 'src/assets/svg/vessels/ais_passenger.svg?raw';
import vesselSpecial from 'src/assets/svg/vessels/ais_special.svg?raw';
import vesselTanker from 'src/assets/svg/vessels/ais_tanker.svg?raw';
import vesselUnknown from 'src/assets/svg/vessels/ais_unknown.svg?raw';

export type IconKey =
  | 'aton/basestation'
  | 'aton/real-aton'
  | 'aton/real-danger'
  | 'aton/real-east'
  | 'aton/real-north'
  | 'aton/real-port'
  | 'aton/real-safe'
  | 'aton/real-south'
  | 'aton/real-special'
  | 'aton/real-starboard'
  | 'aton/real-west'
  | 'aton/virtual-aton'
  | 'aton/virtual-danger'
  | 'aton/virtual-east'
  | 'aton/virtual-north'
  | 'aton/virtual-port'
  | 'aton/virtual-safe'
  | 'aton/virtual-south'
  | 'aton/virtual-special'
  | 'aton/virtual-starboard'
  | 'aton/virtual-west'
  | 'vessel/active'
  | 'vessel/cargo'
  | 'vessel/highspeed'
  | 'vessel/inactive'
  | 'vessel/other'
  | 'vessel/passenger'
  | 'vessel/sar'
  | 'vessel/special'
  | 'vessel/tanker'
  | 'vessel/unknown'
  | 'beacon/sart'
  | 'beacon/mob'
  | 'beacon/epirb';

/**
 * Standard Signal K AIS fields needed to resolve an icon.
 *
 * Example:
 * ```ts
 * const input: AisIconInput = {
 *   type: 'vessel',
 *   navState: 'moored',
 *   aisShipTypeId: 70,
 *   mmsi: '366123456'
 * };
 * ```
 */
export interface AisIconInput {
  mmsi: string | number;
  type?: string;
  navState?: string | number;
  aisShipTypeId?: number;
  atonVirtual?: boolean;
  atonTypeName?: string;
}

const ICON_SVGS: Record<IconKey, string> = {
  'aton/basestation': atonBasestation,
  'aton/real-aton': atonReal,
  'aton/real-danger': atonRealDanger,
  'aton/real-east': atonRealEast,
  'aton/real-north': atonRealNorth,
  'aton/real-port': atonRealPort,
  'aton/real-safe': atonRealSafe,
  'aton/real-south': atonRealSouth,
  'aton/real-special': atonRealSpecial,
  'aton/real-starboard': atonRealStarboard,
  'aton/real-west': atonRealWest,
  'aton/virtual-aton': atonVirtual,
  'aton/virtual-danger': atonVirtualDanger,
  'aton/virtual-east': atonVirtualEast,
  'aton/virtual-north': atonVirtualNorth,
  'aton/virtual-port': atonVirtualPort,
  'aton/virtual-safe': atonVirtualSafe,
  'aton/virtual-south': atonVirtualSouth,
  'aton/virtual-special': atonVirtualSpecial,
  'aton/virtual-starboard': atonVirtualStarboard,
  'aton/virtual-west': atonVirtualWest,
  'vessel/active': vesselActive,
  'vessel/cargo': vesselCargo,
  'vessel/highspeed': vesselHighspeed,
  'vessel/inactive': vesselInactive,
  'vessel/other': vesselOther,
  'vessel/passenger': vesselPassenger,
  'vessel/sar': vesselSpecial,
  'vessel/special': vesselSpecial,
  'vessel/tanker': vesselTanker,
  'vessel/unknown': vesselUnknown,
  'beacon/sart': vesselSpecial,
  'beacon/mob': vesselSpecial,
  'beacon/epirb': vesselSpecial
};

/**
 * Resolve the icon key and return its raw SVG string. This function
 * integrates both resolveIconKey() and getIconSvg() in one step for convenience.
 *
 * @param input - Standard Signal K AIS fields used for icon selection.
 * @returns Raw SVG markup string.
 *
 * Example:
 * ```ts
 * const svg = resolveIconSvg({ type: 'vessel', aisShipTypeId: 70 });
 * ```
 */
export function resolveIconSvg(input: AisIconInput): string {
  return getIconSvg(resolveIconKey(input));
}

/**
 * Return the raw SVG string for a given icon key.
 *
 * @param key - Registry icon key (e.g., 'vessel/cargo').
 * @returns Raw SVG markup string.
 *
 * Example:
 * ```ts
 * const svg = getIconSvg('vessel/cargo');
 * ```
 */
export function getIconSvg(key: IconKey): string {
  return ICON_SVGS[key];
}

/**
 * Resolve the icon key from standard Signal K AIS field values.
 *
 * @param input - Standard Signal K AIS fields used for icon selection.
 * @returns Icon key resolved from the input fields.
 *
 * Example:
 * ```ts
 * const key = resolveIconKey({
 *   type: 'aton',
 *   atonVirtual: true,
 *   atonTypeName: 'north'
 * });
 * // key === 'aton/virtual-north'
 * ```
 */
export function resolveIconKey(input: AisIconInput): IconKey {
  const beaconKey = resolveBeaconKey(normalizeMmsi(input.mmsi));
  if (beaconKey) return beaconKey;

  if ((input.type === 'vessel' || !input.type) && isStationaryNavState(input.navState)) {
    return 'vessel/inactive';
  }

  switch (input.type) {
    case 'aton':
      return resolveAtonKey(input.atonVirtual ?? false, input.atonTypeName ?? '');
    case 'basestation':
      return 'aton/basestation';
    case 'sar':
      return 'vessel/sar';
    case 'vessel':
      return resolveVesselKey(input.navState, input.aisShipTypeId ?? null);
    default:
      return 'vessel/unknown';
  }
}

function normalizeMmsi(mmsi: string | number | null | undefined): string | null {
  if (mmsi === null || mmsi === undefined) return null;
  const value = typeof mmsi === 'number' ? String(mmsi) : mmsi;
  return value.length ? value : null;
}

function resolveBeaconKey(mmsi: string | null): IconKey | null {
  if (!mmsi) return null;
  if (mmsi.startsWith('970')) return 'beacon/sart';
  if (mmsi.startsWith('972')) return 'beacon/mob';
  if (mmsi.startsWith('974')) return 'beacon/epirb';
  return null;
}

function resolveAtonKey(isVirtual: boolean, typeName: string): IconKey {
  const prefix = isVirtual ? 'virtual' : 'real';
  const name = typeName.toLowerCase();

  if (name.includes('north')) return `aton/${prefix}-north` as IconKey;
  if (name.includes('south')) return `aton/${prefix}-south` as IconKey;
  if (name.includes('east')) return `aton/${prefix}-east` as IconKey;
  if (name.includes('west')) return `aton/${prefix}-west` as IconKey;
  if (name.includes('port')) return `aton/${prefix}-port` as IconKey;
  if (name.includes('starboard')) return `aton/${prefix}-starboard` as IconKey;
  if (name.includes('safe')) return `aton/${prefix}-safe` as IconKey;
  if (name.includes('special')) return `aton/${prefix}-special` as IconKey;
  if (name.includes('danger')) return `aton/${prefix}-danger` as IconKey;

  return `aton/${prefix}-aton` as IconKey;
}

function resolveVesselKey(navState: string | number | null | undefined, shipTypeId: number | null): IconKey {
  if (isStationaryNavState(navState)) return 'vessel/inactive';

  if (shipTypeId !== null) {
    if (shipTypeId >= 40 && shipTypeId <= 49) return 'vessel/highspeed';
    if (shipTypeId >= 50 && shipTypeId <= 59) return 'vessel/special';
    if (shipTypeId >= 60 && shipTypeId <= 69) return 'vessel/passenger';
    if (shipTypeId >= 70 && shipTypeId <= 79) return 'vessel/cargo';
    if (shipTypeId >= 80 && shipTypeId <= 89) return 'vessel/tanker';
    if (shipTypeId >= 90 && shipTypeId <= 99) return 'vessel/other';
  }

  return 'vessel/active';
}

function isStationaryNavState(value: string | number | null | undefined): boolean {
  const code = normalizeNavStateCode(value);
  if (code !== undefined) return code === 1 || code === 5;

  const text = normalizeNavStateText(value);
  if (!text) return false;
  return text.includes('moored') || text.includes('anchored') || text.includes('at anchor');
}

function normalizeNavStateCode(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeNavStateText(value: string | number | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed.replace(/\s+/g, ' ') : undefined;
}
