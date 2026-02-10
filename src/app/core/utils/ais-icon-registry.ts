import {
  AisIconTargetKind,
  AisIconTargetState,
  AisIconThemeInput,
  AisIconTheme,
  applyAisIconTheme,
  buildAisIconTheme,
  svgToDataUrl
} from './ais-svg-icon.util';

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
  | 'vessel/fishing'
  | 'vessel/diving'
  | 'vessel/military'
  | 'vessel/sailing'
  | 'vessel/pleasurecraft'
  | 'vessel/cargo'
  | 'vessel/highspeed'
  | 'vessel/stationary'
  | 'vessel/other'
  | 'vessel/pilot'
  | 'vessel/passenger'
  | 'vessel/sar'
  | 'vessel/tanker'
  | 'vessel/tug'
  | 'vessel/spare'
  | 'vessel/law'
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

export interface AisIconRenderInput extends AisIconInput {
  status?: 'confirmed' | 'unconfirmed' | 'lost';
  collisionRiskRating?: number;
  targetKind?: AisIconTargetKind;
  themeOverrides?: Partial<AisIconThemeInput>;
}

const rawSvgCache = new Map<IconKey, string>();
const pendingFetch = new Map<IconKey, Promise<string>>();
const themedSvgCache = new Map<string, string>();
const themedDataUrlCache = new Map<string, string>();
const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#12f802" stroke="#fb05eb" stroke-width="1.4"/></svg>';

const ICON_URLS: Record<IconKey, string> = {
  'aton/basestation': 'assets/svg/atons/basestation.svg',
  'aton/real-aton': 'assets/svg/atons/real-aton.svg',
  'aton/real-danger': 'assets/svg/atons/real-danger.svg',
  'aton/real-east': 'assets/svg/atons/real-east.svg',
  'aton/real-north': 'assets/svg/atons/real-north.svg',
  'aton/real-port': 'assets/svg/atons/real-port.svg',
  'aton/real-safe': 'assets/svg/atons/real-safe.svg',
  'aton/real-south': 'assets/svg/atons/real-south.svg',
  'aton/real-special': 'assets/svg/atons/real-special.svg',
  'aton/real-starboard': 'assets/svg/atons/real-starboard.svg',
  'aton/real-west': 'assets/svg/atons/real-west.svg',
  'aton/virtual-aton': 'assets/svg/atons/virtual-aton.svg',
  'aton/virtual-danger': 'assets/svg/atons/virtual-danger.svg',
  'aton/virtual-east': 'assets/svg/atons/virtual-east.svg',
  'aton/virtual-north': 'assets/svg/atons/virtual-north.svg',
  'aton/virtual-port': 'assets/svg/atons/virtual-port.svg',
  'aton/virtual-safe': 'assets/svg/atons/virtual-safe.svg',
  'aton/virtual-south': 'assets/svg/atons/virtual-south.svg',
  'aton/virtual-special': 'assets/svg/atons/virtual-special.svg',
  'aton/virtual-starboard': 'assets/svg/atons/virtual-starboard.svg',
  'aton/virtual-west': 'assets/svg/atons/virtual-west.svg',

  'beacon/sart': 'assets/svg/vessels/ais_special.svg',
  'beacon/mob': 'assets/svg/vessels/ais_special.svg',
  'beacon/epirb': 'assets/svg/vessels/ais_special.svg',

  'vessel/stationary': 'assets/svg/vessels/ais_stationary.svg',
  'vessel/fishing': 'assets/svg/vessels/ais_fishing.svg',
  'vessel/diving': 'assets/svg/vessels/ais_diving-ops.svg',
  'vessel/military': 'assets/svg/vessels/ais_military-ops.svg',
  'vessel/sailing': 'assets/svg/vessels/ais_sailing.svg',
  'vessel/pleasurecraft': 'assets/svg/vessels/ais_pleasurecraft.svg',
  'vessel/highspeed': 'assets/svg/vessels/ais_highspeed.svg',
  'vessel/pilot': 'assets/svg/vessels/ais_pilot.svg',
  'vessel/sar': 'assets/svg/vessels/ais_sar.svg',
  'vessel/tug': 'assets/svg/vessels/ais_tug.svg',
  'vessel/law': 'assets/svg/vessels/ais_law-enforcement.svg',
  'vessel/spare': 'assets/svg/vessels/ais_other.svg',
  'vessel/passenger': 'assets/svg/vessels/ais_passenger.svg',
  'vessel/cargo': 'assets/svg/vessels/ais_cargo-tanker.svg',
  'vessel/tanker': 'assets/svg/vessels/ais_cargo-tanker.svg',
  'vessel/other': 'assets/svg/vessels/ais_other.svg',
  'vessel/unknown': 'assets/svg/vessels/ais_unknown.svg'
};

const AIS_SHIP_TYPE_ICON_RANGES: { min: number; max: number; key: IconKey }[] = [
  { min: 0, max: 9, key: 'vessel/other' }, // Reserved for future use
  { min: 10, max: 19, key: 'vessel/other' }, // Unspecified
  { min: 20, max: 29, key: 'vessel/highspeed' }, // Wing-in-ground aircraft
  { min: 30, max: 30, key: 'vessel/fishing' }, // Fishing
  { min: 31, max: 31, key: 'vessel/tug' }, // Towing
  { min: 32, max: 32, key: 'vessel/tug' }, // Towing: length exceeds 200m or breadth exceeds 25m
  { min: 33, max: 33, key: 'vessel/tug' }, // Dredging or underwater ops
  { min: 34, max: 34, key: 'vessel/diving' }, // Diving ops
  { min: 35, max: 35, key: 'vessel/military' }, // Military ops
  { min: 36, max: 36, key: 'vessel/sailing' }, // Sailing
  { min: 37, max: 37, key: 'vessel/pleasurecraft' }, // Pleasure Craft
  { min: 38, max: 39, key: 'vessel/other' }, // Reserved for future use
  { min: 40, max: 49, key: 'vessel/highspeed' }, // High Speed Vessel
  { min: 50, max: 50, key: 'vessel/pilot' }, // Pilot Vessel
  { min: 51, max: 51, key: 'vessel/sar' }, // Search and Rescue vessel
  { min: 52, max: 52, key: 'vessel/tug' }, // Tug
  { min: 53, max: 53, key: 'vessel/tug' }, // Port Tender
  { min: 54, max: 54, key: 'vessel/tug' }, // Anti-pollution equipment
  { min: 55, max: 55, key: 'vessel/law' }, // Law Enforcement
  { min: 56, max: 56, key: 'vessel/other' }, // Spare - Local Vessel
  { min: 57, max: 57, key: 'vessel/other' }, // Spare - Local Vessel
  { min: 58, max: 58, key: 'vessel/tug' }, // Medical Transport
  { min: 59, max: 59, key: 'vessel/tug' }, // Noncombatant ship according to RR Resolution No. 18
  { min: 60, max: 69, key: 'vessel/passenger' }, // Passenger Vessel
  { min: 70, max: 79, key: 'vessel/cargo' }, // Cargo Vessel
  { min: 80, max: 89, key: 'vessel/tanker' }, // Tanker Vessel
  { min: 90, max: 99, key: 'vessel/other' } // Other
];

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
export async function resolveIconSvg(input: AisIconInput): Promise<string> {
  return getIconSvg(resolveIconKey(input));
}

/**
 * Resolve the icon SVG and apply AIS target theming (state + collision risk), and return raw SVG markup.
 *
 * Use when you need raw SVG markup for inline rendering or further processing.
 * See also resolveThemedIconDataUrl and resolveThemedIconOptions for other output formats.
 */
export async function resolveThemedIconSvg(input: AisIconRenderInput): Promise<string> {
  const theme = buildAisIconTheme(buildAisIconThemeInput(input));
  return getThemedSvg(resolveIconKey(input), theme);
}

/**
 * Resolve the icon SVG, apply AIS target theming (state + collision risk), and return a data URL.
 *
 * Use for `<img>`/`<image href>` sources (e.g., AIS radar) where a data URL is required.
 * See also resolveThemedIconSvg and resolveThemedIconOptions for other output formats.
 */
export async function resolveThemedIconDataUrl(input: AisIconRenderInput): Promise<string> {
  const theme = buildAisIconTheme(buildAisIconThemeInput(input));
  return getThemedDataUrl(resolveIconKey(input), theme);
}

/**
 * Resolve the icon SVG, apply AIS target theming (state + collision risk), and return icon options for map libraries.
 *
 * Use when creating map icons (OpenLayers) that expect an options object.
 * See also resolveThemedIconSvg and resolveThemedIconDataUrl for other output formats.
 *
 * Example (OpenLayers):
 * ```ts
 * import { Icon } from 'ol/style';
 *
 * const options = await resolveThemedIconOptions({
 *   type: 'vessel',
 *   mmsi: '366123456',
 *   status: 'confirmed',
 *   collisionRiskRating: 12000
 * });
 * const icon = new Icon(options);
 * ```
 */
export async function resolveThemedIconOptions(input: AisIconRenderInput) {
  const theme = buildAisIconTheme(buildAisIconThemeInput(input));
  const key = resolveIconKey(input);
  const dataUrl = await getThemedDataUrl(key, theme);
  return {
    src: dataUrl,
    anchor: [0.5, 0.5],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    scale: 1
  } as const;
}

/**
 * Return the raw SVG string for a given icon key.
 * Low-level helper: prefer resolveThemedIconSvg/resolveThemedIconDataUrl/resolveThemedIconOptions in most cases.
 *
 * @param key - Registry icon key (e.g., 'vessel/cargo').
 * @returns Raw SVG markup string.
 *
 * Example:
 * ```ts
 * const svg = getIconSvg('vessel/cargo');
 * ```
 */
export async function getIconSvg(key: IconKey): Promise<string> {
  const cached = rawSvgCache.get(key);
  if (cached) return cached;

  const pending = pendingFetch.get(key);
  if (pending) return pending;

  const url = ICON_URLS[key];
  const request = fetch(url)
    .then(response => (response.ok ? response.text() : FALLBACK_SVG))
    .catch(() => FALLBACK_SVG)
    .then(svg => {
      rawSvgCache.set(key, svg);
      pendingFetch.delete(key);
      return svg;
    });

  pendingFetch.set(key, request);
  return request;
}

async function getThemedSvg(key: IconKey, theme: AisIconTheme): Promise<string> {
  const cacheKey = buildThemedCacheKey(key, theme);
  const cached = themedSvgCache.get(cacheKey);
  if (cached) return cached;

  const svg = await getIconSvg(key);
  const themedSvg = applyAisIconTheme(svg, theme);
  themedSvgCache.set(cacheKey, themedSvg);
  return themedSvg;
}

async function getThemedDataUrl(key: IconKey, theme: AisIconTheme): Promise<string> {
  const cacheKey = buildThemedCacheKey(key, theme);
  const cached = themedDataUrlCache.get(cacheKey);
  if (cached) return cached;

  const themedSvg = await getThemedSvg(key, theme);
  const dataUrl = svgToDataUrl(themedSvg);
  themedDataUrlCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function buildThemedCacheKey(key: IconKey, theme: AisIconTheme): string {
  return `${key}|${buildThemeHash(theme)}`;
}

function buildThemeHash(theme: AisIconTheme): string {
  return [
    stringToKey(theme.fill),
    stringToKey(theme.stroke),
    numberToKey(theme.fillOpacity),
    numberToKey(theme.strokeOpacity),
    numberToKey(theme.strokeWidth),
    numberToKey(theme.sizePx)
  ].join('|');
}

function stringToKey(value: string | undefined): string {
  return value ?? '';
}

function numberToKey(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  return value.toFixed(4);
}

/**
 * Resolve the icon key from standard Signal K AIS field values.
 * Low-level helper: prefer resolveThemedIconSvg/resolveThemedIconDataUrl/resolveThemedIconOptions in most cases.
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
    return 'vessel/stationary';
  }

  switch (input.type) {
    case 'aton':
      return resolveAtonKey(input.atonVirtual ?? false, input.atonTypeName ?? '');
    case 'basestation':
      return 'aton/basestation';
    case 'sar':
      return 'vessel/sar';
    case 'vessel':
      return resolveVesselKey(input.aisShipTypeId ?? null);
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

function resolveVesselKey(shipTypeId: number | null): IconKey {
  if (shipTypeId !== null) {
    for (const entry of AIS_SHIP_TYPE_ICON_RANGES) {
      if (shipTypeId >= entry.min && shipTypeId <= entry.max) return entry.key;
    }
  }

  return 'vessel/other';
}

function buildAisIconThemeInput(input: AisIconRenderInput): AisIconThemeInput {
  // Treat stationary nav states as fixed so collision styling does not apply.
  const targetKind = input.targetKind
    ?? (isStationaryNavState(input.navState) ? 'fixed' : resolveTargetKind(input.type));
  const targetState: AisIconTargetState = input.status === 'unconfirmed' ? 'unconfirmed' : 'confirmed';
  return {
    targetKind,
    targetState,
    collisionRiskRating: input.collisionRiskRating,
    ...input.themeOverrides
  };
}

function resolveTargetKind(type?: string): AisIconTargetKind {
  switch (type) {
    case 'aton':
    case 'basestation':
      return 'fixed';
    case 'vessel':
    case 'sar':
    case 'aircraft':
    case 'beacon':
    default:
      return 'moving';
  }
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
