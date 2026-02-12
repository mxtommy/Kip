import {
  AisIconTargetKind,
  AisIconTargetState,
  AisIconThemeInput,
  AisIconTheme,
  applyAisIconTheme,
  buildAisIconTheme,
  svgToDataUrl
} from './ais-svg-icon.util';

export type AtonIconKey =
  | 'aton/other'
  | 'aton/basestation'
  | 'aton/east-beacon'
  | 'aton/east-mark'
  | 'aton/west-beacon'
  | 'aton/west-mark'
  | 'aton/north-beacon'
  | 'aton/north-mark'
  | 'aton/south-beacon'
  | 'aton/south-mark'
  | 'aton/port-beacon'
  | 'aton/starboard-beacon'
  | 'aton/port-preferred-beacon'
  | 'aton/starboard-preferred-beacon'
  | 'aton/port-mark'
  | 'aton/starboard-mark'
  | 'aton/port-preferred-mark'
  | 'aton/starboard-preferred-mark'
  | 'aton/safewater-beacon'
  | 'aton/safewater-mark'
  | 'aton/special-beacon'
  | 'aton/special-mark'
  | 'aton/isolateddanger-beacon'
  | 'aton/isolateddanger-mark'
  | 'aton/unknown';

export type VesselIconKey =
  | 'vessel/fishing'
  | 'vessel/diving'
  | 'vessel/military'
  | 'vessel/sailing'
  | 'vessel/pleasurecraft'
  | 'vessel/cargo'
  | 'vessel/highspeed'
  | 'vessel/other'
  | 'vessel/pilot'
  | 'vessel/passenger'
  | 'vessel/sar'
  | 'vessel/tanker'
  | 'vessel/tug'
  | 'vessel/spare'
  | 'vessel/law'
  | 'vessel/unknown'
  | 'vessel/self';

export type BeaconIconKey =
  | 'beacon/sart'
  | 'beacon/mob'
  | 'beacon/epirb';

export type IconKey = AtonIconKey | VesselIconKey | BeaconIconKey;

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
  atonTypeId?: number;
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
const rawDataUrlCache = new Map<IconKey, string>();
const themedSvgCache = new Map<string, string>();
const themedDataUrlCache = new Map<string, string>();
const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#12f802" stroke="#fb05eb" stroke-width="1.4"/></svg>';

const AtoN_URLS: Record<AtonIconKey, string> = {
  'aton/other': 'assets/svg/AtoN/other/aton.svg',
  'aton/basestation': 'assets/svg/AtoN/other/basestation.svg',
  'aton/east-beacon': 'assets/svg/AtoN/cardinal/east_beacon.svg',
  'aton/east-mark': 'assets/svg/AtoN/cardinal/east_mark.svg',
  'aton/west-beacon': 'assets/svg/AtoN/cardinal/west_beacon.svg',
  'aton/west-mark': 'assets/svg/AtoN/cardinal/west_mark.svg',
  'aton/north-beacon': 'assets/svg/AtoN/cardinal/north_beacon.svg',
  'aton/north-mark': 'assets/svg/AtoN/cardinal/north_mark.svg',
  'aton/south-beacon': 'assets/svg/AtoN/cardinal/south_beacon.svg',
  'aton/south-mark': 'assets/svg/AtoN/cardinal/south_mark.svg',
  'aton/port-beacon': 'assets/svg/AtoN/lateral/port_beacon.svg',
  'aton/starboard-beacon': 'assets/svg/AtoN/lateral/starboard_beacon.svg',
  'aton/port-preferred-beacon': 'assets/svg/AtoN/lateral/port_preferred_beacon.svg',
  'aton/starboard-preferred-beacon': 'assets/svg/AtoN/lateral/starboard_preferred_beacon.svg',
  'aton/port-mark': 'assets/svg/AtoN/lateral/port_mark.svg',
  'aton/starboard-mark': 'assets/svg/AtoN/lateral/starboard_mark.svg',
  'aton/port-preferred-mark': 'assets/svg/AtoN/lateral/port_preferred_mark.svg',
  'aton/starboard-preferred-mark': 'assets/svg/AtoN/lateral/starboard_preferred_mark.svg',
  'aton/special-beacon': 'assets/svg/AtoN/special/special_beacon.svg',
  'aton/special-mark': 'assets/svg/AtoN/special/special_mark.svg',
  'aton/safewater-beacon': 'assets/svg/AtoN/dangerSafe/safewater_beacon.svg',
  'aton/safewater-mark': 'assets/svg/AtoN/dangerSafe/safewater_mark.svg',
  'aton/isolateddanger-beacon': 'assets/svg/AtoN/dangerSafe/isolateddanger_beacon.svg',
  'aton/isolateddanger-mark': 'assets/svg/AtoN/dangerSafe/isolateddanger_mark.svg',
  'aton/unknown': 'assets/svg/AtoN/other/unknown.svg'
};

const VESSEL_URLS: Record<VesselIconKey, string> = {
  'vessel/fishing': 'assets/svg/vessel/fishing.svg',
  'vessel/diving': 'assets/svg/vessel/diving-ops.svg',
  'vessel/military': 'assets/svg/vessel/military-ops.svg',
  'vessel/sailing': 'assets/svg/vessel/sailing.svg',
  'vessel/pleasurecraft': 'assets/svg/vessel/pleasurecraft.svg',
  'vessel/highspeed': 'assets/svg/vessel/highspeed.svg',
  'vessel/pilot': 'assets/svg/vessel/pilot.svg',
  'vessel/sar': 'assets/svg/vessel/sar.svg',
  'vessel/tug': 'assets/svg/vessel/tug.svg',
  'vessel/law': 'assets/svg/vessel/law-enforcement.svg',
  'vessel/spare': 'assets/svg/vessel/other.svg',
  'vessel/passenger': 'assets/svg/vessel/passenger.svg',
  'vessel/cargo': 'assets/svg/vessel/cargo.svg',
  'vessel/tanker': 'assets/svg/vessel/tanker.svg',
  'vessel/other': 'assets/svg/vessel/other.svg',
  'vessel/unknown': 'assets/svg/vessel/unknown.svg',
  'vessel/self': 'assets/svg/vessel/self.svg'
};

export const VESSEL_ICON_KEYS = Object.keys(VESSEL_URLS) as VesselIconKey[];

const BEACON_URLS: Record<BeaconIconKey, string> = {
  'beacon/sart': 'assets/svg/sar-distress-device/sart-eprib-mob.svg',
  'beacon/mob': 'assets/svg/sar-distress-device/sart-eprib-mob.svg',
  'beacon/epirb': 'assets/svg/sar-distress-device/sart-eprib-mob.svg'
};

const ICON_URLS: Record<IconKey, string> = {
  ...AtoN_URLS,
  ...VESSEL_URLS,
  ...BEACON_URLS
};

const AIS_ATON_TYPE_ICON_MAP: { code: number; key: AtonIconKey }[] = [
  { code: 0, key: 'aton/other' }, // Default / Not specified
  { code: 1, key: 'aton/other' }, // Reference point
  { code: 2, key: 'aton/other' }, // RACON
  { code: 3, key: 'aton/other' }, // Fixed structure (off-shore platform, wind farm, etc.)
  { code: 4, key: 'aton/other' }, // Spare
  { code: 5, key: 'aton/other' }, // Light, without sectors
  { code: 6, key: 'aton/other' }, // Light, with sectors
  { code: 7, key: 'aton/other' }, // Leading light (front)
  { code: 8, key: 'aton/other' }, // Leading light (rear)

  { code: 9, key: 'aton/north-beacon' }, // Beacon, cardinal N
  { code: 10, key: 'aton/east-beacon' }, // Beacon, cardinal E
  { code: 11, key: 'aton/south-beacon' }, // Beacon, cardinal S
  { code: 12, key: 'aton/west-beacon' }, // Beacon, cardinal W
  { code: 13, key: 'aton/port-beacon' }, // Beacon, port-hand
  { code: 14, key: 'aton/starboard-beacon' }, // Beacon, starboard-hand
  { code: 15, key: 'aton/port-preferred-beacon' }, // Beacon, preferred channel port
  { code: 16, key: 'aton/starboard-preferred-beacon' }, // Beacon, preferred channel starboard
  { code: 17, key: 'aton/isolateddanger-beacon' }, // Beacon, isolated danger
  { code: 18, key: 'aton/safewater-beacon' }, // Beacon, safe water
  { code: 19, key: 'aton/special-beacon' }, // Beacon, special mark
  { code: 20, key: 'aton/north-mark' }, // Cardinal mark N
  { code: 21, key: 'aton/east-mark' }, // Cardinal mark E
  { code: 22, key: 'aton/south-mark' }, // Cardinal mark S
  { code: 23, key: 'aton/west-mark' }, // Cardinal mark W
  { code: 24, key: 'aton/port-mark' }, // Port-hand mark
  { code: 25, key: 'aton/starboard-mark' }, // Starboard-hand mark
  { code: 26, key: 'aton/port-preferred-mark' }, // Preferred channel port mark
  { code: 27, key: 'aton/starboard-preferred-mark' }, // Preferred channel starboard mark
  { code: 28, key: 'aton/isolateddanger-mark' }, // Isolated danger
  { code: 29, key: 'aton/safewater-mark' }, // Safe water
  { code: 30, key: 'aton/special-mark' }, // Special mark

  { code: 31, key: 'aton/other' } // Light vessel / LANBY / large buoy
];

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
 * Resolve the ownship icon as a raw (unthemed) SVG data URL.
 * The ais_self icon is intentionally not themed so it always renders with its baked-in styling.
 */
export async function resolveOwnShipIconDataUrl(): Promise<string> {
  return getIconDataUrl('vessel/self');
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
    .then(response => {
      if (response.ok) return response.text();
      return FALLBACK_SVG;
    })
    .catch(error => {
      console.warn('[ais-icon-registry] Icon fetch error, using fallback.', { key, url, error });
      return FALLBACK_SVG;
    })
    .then(svg => {
      rawSvgCache.set(key, svg);
      pendingFetch.delete(key);
      return svg;
    });

  pendingFetch.set(key, request);
  return request;
}

async function getIconDataUrl(key: IconKey): Promise<string> {
  const cached = rawDataUrlCache.get(key);
  if (cached) return cached;

  const svg = await getIconSvg(key);
  const dataUrl = svgToDataUrl(svg);
  rawDataUrlCache.set(key, dataUrl);
  return dataUrl;
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
    stringToKey(theme.auraColor),
    numberToKey(theme.fillOpacity),
    numberToKey(theme.strokeOpacity),
    numberToKey(theme.auraOpacity),
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

  switch (input.type) {
    case 'aton':
      return resolveAtonKey(input.atonTypeId ?? null, input.atonVirtual ?? false);
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

function resolveAtonKey(typeId: number | null, isVirtual: boolean): IconKey {
  const code = typeof typeId === 'number' && Number.isFinite(typeId) ? typeId : null;
  const match = code === null
    ? undefined
    : AIS_ATON_TYPE_ICON_MAP.find(entry => entry.code === code);
  const baseKey = match?.key ?? 'aton/unknown';
  return applyAtonTheme(baseKey, isVirtual);
}

function applyAtonTheme(key: AtonIconKey, isVirtual: boolean): AtonIconKey {
  return key;
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
  const isStationary = isStationaryNavState(input.navState);
  const targetKind = input.targetKind
    ?? (isStationary ? 'fixed' : resolveTargetKind(input.type));
  const targetState: AisIconTargetState = input.status === 'unconfirmed' || input.status === 'lost'
    ? 'unconfirmed'
    : 'confirmed';
  return {
    targetKind,
    targetState,
    isStationary,
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
