import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject, merge, throttleTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService, IPathUpdateWithPath } from './data.service';

const AIS_DEBUG = false;
const THROTTLE_MS = 250;

type AisClass = 'A' | 'B' | undefined;
type AisTargetType = 'vessel' | 'aton' | 'basestation' | 'sar';
export type AisStatus = 'unconfirmed' | 'confirmed' | 'lost' | 'remove';

export interface Position {
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface AisTarget {
  context: string;
  mmsi?: string;
  name?: string;
  type: AisTargetType;
  ais: {
    class?: AisClass;
    status?: AisStatus;
  };
  position?: Position;
  lastPositionAt?: number; // timestamp of last position report
  lastUpdateAt: number; // timestamp of last update of any kind
  id: string;
  conflicted?: boolean;
}

interface AisVesselLike extends AisTarget {
  callsign?: string;
  destination?: string;
  eta?: string;
  imo?: string;
  design?: {
    beam?: number;
    length?: {
      overall?: number;
      hull?: number;
      waterline?: number;
    };
    draft?: {
      maximum?: number;
      minimum?: number;
      current?: number;
      canoe?: number;
    };
    aisShipType?: {
      id?: number;
      name?: string;
    };
  };
  navState?: string;
  headingTrue?: number;
  courseOverGroundTrue?: number;
  speedOverGround?: number;
  rateOfTurn?: number;
  specialManeuver?: string;
  fromBow?: number;
  fromCenter?: number;
  // Collision avoidance fields from SignalK AIS Target Prioritizer plugin
  closestApproach?: {
    distance?: number; // NM
    timeTo?: number;   // s
    range?: number;    // NM
    bearing?: number;  // deg
    collisionRiskRating?: number; // lower is more risky
  };
}

export interface AisVessel extends AisVesselLike {
  type: 'vessel';
}

export interface AisSar extends AisVesselLike {
  type: 'sar';
}

export interface AisAton extends AisTarget {
  type: 'aton';
  typeId?: number;
  typeName?: string;
  virtual?: boolean;
  offPosition?: boolean;
}

export interface AisBasestation extends AisTarget {
  type: 'basestation';
}

export type AisTrack = AisVessel | AisSar | AisAton | AisBasestation;

export interface OwnShipState {
  position?: Position;
  headingTrue?: number;
  courseOverGroundTrue?: number;
  speedOverGround?: number;
}

interface AisUpdate {
  context: string;
  type: AisTargetType;
  path: string;
  value: unknown;
  timestampMs: number;
}

const AIS_TREE_PREFIXES = [
  'atons.urn:mrn:imo:mmsi:*',
  'shore.basestations.urn:mrn:imo:mmsi:*',
  'vessels.urn:mrn:imo:mmsi:*',
  'sar.urn:mrn:imo:mmsi:*'
];

const AIS_CONTEXT_PREFIXES: { prefix: string; type: AisTargetType }[] = [
  { prefix: 'atons.urn:mrn:imo:mmsi:', type: 'aton' },
  { prefix: 'shore.basestations.urn:mrn:imo:mmsi:', type: 'basestation' },
  { prefix: 'vessels.urn:mrn:imo:mmsi:', type: 'vessel' },
  { prefix: 'sar.urn:mrn:imo:mmsi:', type: 'sar' }
];

const SELF_NAV_PREFIX = 'self.navigation.*';

@Injectable({
  providedIn: 'root'
})
export class AisProcessingService {
  private readonly data = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tracks = new Map<string, AisTrack>();
  private readonly contextIndex = new Map<string, string>();
  private readonly mmsiIndex = new Map<string, Set<string>>();
  private readonly targetsDirty$ = new Subject<void>();

  private readonly _targets = signal<AisTrack[]>([]);
  private readonly _ownShip = signal<OwnShipState>({});
  private readonly _hasCollisionRiskData = signal(false);

  public readonly targets = this._targets.asReadonly();
  public readonly ownShip = this._ownShip.asReadonly();
  public readonly hasCollisionRiskData = this._hasCollisionRiskData.asReadonly();

  public getBearingTrue(from: Position, to: Position): number | null {
    if (
      typeof from.latitude !== 'number'
      || typeof from.longitude !== 'number'
      || typeof to.latitude !== 'number'
      || typeof to.longitude !== 'number'
    ) return null;
    const phi1 = from.latitude * Math.PI / 180;
    const phi2 = to.latitude * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return this.wrapDegrees(bearing);
  }

  constructor() {
    const aisTree$ = merge(...AIS_TREE_PREFIXES.map(prefix => this.data.subscribePathTree(prefix)));
    aisTree$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleAisTreeUpdate(event));

    this.data.subscribePathTree(SELF_NAV_PREFIX)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleOwnShipTreeUpdate(event));

    this.targetsDirty$
      .pipe(throttleTime(THROTTLE_MS, undefined, { leading: true, trailing: true }), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.flushTargetsSignal());

  }

  private handleAisTreeUpdate(event: IPathUpdateWithPath): void {
    const match = this.matchAisContext(event.path);
    if (!match) return;

    if (AIS_DEBUG) {
      console.debug('[AIS] update', {
        context: match.context,
        path: match.path,
        type: match.type,
        value: event.update.data.value
      });
    }

    this.applyAisUpdate({
      context: match.context,
      type: match.type,
      path: match.path,
      value: event.update.data.value,
      timestampMs: this.toTimestampMs(event.update.data.timestamp)
    });
  }

  private handleOwnShipTreeUpdate(event: IPathUpdateWithPath): void {
    if (!event.path.startsWith('self.')) return;
    const path = event.path.slice('self.'.length);
    this.applyOwnShipUpdate(path, event.update.data.value);

    if (AIS_DEBUG) {
      //console.debug('[AIS] ownShip', { path, value: event.update.data.value });
    }
  }

  private matchAisContext(fullPath: string): { context: string; path: string; type: AisTargetType } | null {
    for (const entry of AIS_CONTEXT_PREFIXES) {
      if (!fullPath.startsWith(entry.prefix)) continue;
      const idx = fullPath.indexOf('.', entry.prefix.length);
      if (idx === -1) return null;
      return {
        context: fullPath.slice(0, idx),
        path: fullPath.slice(idx + 1),
        type: entry.type
      };
    }
    return null;
  }

  private applyOwnShipUpdate(path: string, value: unknown): void {
    const next = { ...this._ownShip() } as OwnShipState;
    const position = this.readPositionValue(value);

    switch (path) {
      case 'navigation.position':
        if (position) {
          next.position = position;
        }
        break;
      case 'navigation.position.latitude':
        {
          const lat = this.toNumberOrUndefined(value);
          if (lat === undefined) return;
          next.position = { ...(next.position ?? {}), latitude: lat };
        }
        break;
      case 'navigation.position.longitude':
        {
          const lon = this.toNumberOrUndefined(value);
          if (lon === undefined) return;
          next.position = { ...(next.position ?? {}), longitude: lon };
        }
        break;
      case 'navigation.headingTrue':
        next.headingTrue = this.toNumberOrUndefined(value);
        break;
      case 'navigation.courseOverGroundTrue':
        next.courseOverGroundTrue = this.toNumberOrUndefined(value);
        break;
      case 'navigation.speedOverGround':
        next.speedOverGround = this.toNumberOrUndefined(value);
        break;
      default:
        return;
    }

    this._ownShip.set(next);
  }

  private applyAisUpdate(update: AisUpdate): void {
    const track = this.resolveTrack(update);
    if (!track) return;

    track.lastUpdateAt = update.timestampMs;
    if (update.path.startsWith('navigation.closestApproach.') && this.isVesselLike(track) && !track.closestApproach) {
      track.closestApproach = {};
    }

    let removed = false;
    const handlers: Record<string, () => void> = {
      mmsi: () => this.applyMmsi(track, update.value),
      name: () => { track.name = this.toStringOrUndefined(update.value); },
      'communication.callsignVhf': () => {
        if (this.isVesselLike(track)) {
          track.callsign = this.toStringOrUndefined(update.value);
        }
      },
      'navigation.destination': () => {
        if (this.isVesselLike(track)) {
          track.destination = this.toStringOrUndefined(update.value);
        }
      },
      'navigation.destination.commonName': () => {
        if (this.isVesselLike(track)) {
          track.destination = this.toStringOrUndefined(update.value);
        }
      },
      'navigation.destination.eta': () => {
        if (this.isVesselLike(track)) {
          track.eta = this.toStringOrUndefined(update.value);
        }
      },
      'design.beam': () => {
        if (this.isVesselLike(track)) {
          track.design = { ...(track.design ?? {}), beam: this.toNumberOrUndefined(update.value) };
        }
      },
      'design.length.overall': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            length: { ...(track.design?.length ?? {}), overall: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.length.hull': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            length: { ...(track.design?.length ?? {}), hull: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.length.waterline': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            length: { ...(track.design?.length ?? {}), waterline: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.draft.maximum': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            draft: { ...(track.design?.draft ?? {}), maximum: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.draft.minimum': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            draft: { ...(track.design?.draft ?? {}), minimum: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.draft.current': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            draft: { ...(track.design?.draft ?? {}), current: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.draft.canoe': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            draft: { ...(track.design?.draft ?? {}), canoe: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'registrations.imo': () => {
        if (this.isVesselLike(track)) {
          track.imo = this.toStringOrUndefined(update.value);
        }
      },
      'navigation.courseOverGroundTrue': () => {
        if (this.isVesselLike(track)) {
          track.courseOverGroundTrue = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.headingTrue': () => {
        if (this.isVesselLike(track)) {
          track.headingTrue = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.rateOfTurn': () => {
        if (this.isVesselLike(track)) {
          track.rateOfTurn = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.specialManeuver': () => {
        if (this.isVesselLike(track)) {
          track.specialManeuver = this.toStringOrUndefined(update.value);
        }
      },
      'navigation.speedOverGround': () => {
        if (this.isVesselLike(track)) {
          track.speedOverGround = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.state': () => {
        if (this.isVesselLike(track)) {
          track.navState = this.toStringOrUndefined(update.value);
        }
      },
      'sensors.ais.class': () => {
        track.ais.class = this.normalizeAisClass(update.value);
      },
      'sensors.ais.status': () => {
        const status = this.normalizeAisStatus(update.value);
        if (!status) return;
        if (status === 'remove') {
          this.removeTrack(track);
          removed = true;
          return;
        }
        track.ais.status = status;
      },
      'sensors.ais.fromBow': () => {
        if (this.isVesselLike(track)) {
          track.fromBow = this.toNumberOrUndefined(update.value);
        }
      },
      'sensors.ais.fromCenter': () => {
        if (this.isVesselLike(track)) {
          track.fromCenter = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.position.latitude': () => {
        const latitude = this.toNumberOrUndefined(update.value);
        if (latitude === undefined) return;
        track.position = { ...(track.position ?? {}), latitude };
        track.lastPositionAt = update.timestampMs;
      },
      'navigation.position.longitude': () => {
        const longitude = this.toNumberOrUndefined(update.value);
        if (longitude === undefined) return;
        track.position = { ...(track.position ?? {}), longitude };
        track.lastPositionAt = update.timestampMs;
      },
      'navigation.position.altitude': () => {
        const altitude = this.toNumberOrUndefined(update.value);
        if (track.position) {
          track.position = { ...track.position, altitude };
        }
      },
      'navigation.position': () => {
        const position = this.readPositionValue(update.value);
        if (position) {
          track.position = position;
          track.lastPositionAt = update.timestampMs;
        }
      },
      'atonType.id': () => {
        if (this.isAton(track)) {
          track.typeId = this.toNumberOrUndefined(update.value);
        }
      },
      'atonType.name': () => {
        if (this.isAton(track)) {
          track.typeName = this.toStringOrUndefined(update.value);
        }
      },
      virtual: () => {
        if (this.isAton(track)) {
          track.virtual = Boolean(update.value);
        }
      },
      offPosition: () => {
        if (this.isAton(track)) {
          track.offPosition = Boolean(update.value);
        }
      },
      'design.aisShipType.id': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            aisShipType: { ...(track.design?.aisShipType ?? {}), id: this.toNumberOrUndefined(update.value) }
          };
        }
      },
      'design.aisShipType.name': () => {
        if (this.isVesselLike(track)) {
          track.design = {
            ...(track.design ?? {}),
            aisShipType: { ...(track.design?.aisShipType ?? {}), name: this.toStringOrUndefined(update.value) }
          };
        }
      },
      'navigation.closestApproach.distance': () => {
        if (this.isVesselLike(track) && track.closestApproach) {
          track.closestApproach.distance = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.closestApproach.timeTo': () => {
        if (this.isVesselLike(track) && track.closestApproach) {
          track.closestApproach.timeTo = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.closestApproach.range': () => {
        if (this.isVesselLike(track) && track.closestApproach) {
          track.closestApproach.range = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.closestApproach.bearing': () => {
        if (this.isVesselLike(track) && track.closestApproach) {
          track.closestApproach.bearing = this.toNumberOrUndefined(update.value);
        }
      },
      'navigation.closestApproach.collisionRiskRating': () => {
        if (this.isVesselLike(track) && track.closestApproach) {
          track.closestApproach.collisionRiskRating = this.toNumberOrUndefined(update.value);
        }
      }
    };

    handlers[update.path]?.();
    if (removed) return;

    this.updateTargetsSignal();
  }

  private resolveTrack(update: AisUpdate): AisTrack | null {
    const existingId = this.contextIndex.get(update.context);
    const timestampMs = update.timestampMs;
    const existing = existingId ? this.tracks.get(existingId) : null;

    if (existing) return existing;

    const created = this.createTrack(update.context, update.type, timestampMs, undefined);
    this.contextIndex.set(update.context, created.id);
    return created;
  }

  private createTrack(context: string, type: AisTargetType, timestampMs: number, mmsi?: string): AisTrack {
    const id = this.buildTrackId(mmsi ?? context);
    const base = this.buildBaseTarget(context, type, timestampMs, mmsi, id);
    let track: AisTrack;
    switch (type) {
      case 'vessel':
        track = { ...base, type: 'vessel', closestApproach: {} };
        break;
      case 'sar':
        track = { ...base, type: 'sar', closestApproach: {} };
        break;
      case 'aton':
        track = { ...base, type: 'aton' };
        break;
      case 'basestation':
      default:
        track = { ...base, type: 'basestation' };
        break;
    }

    this.tracks.set(track.id, track);
    if (mmsi) this.addMmsiIndex(mmsi, track.id);
    this.updateTargetsSignal();
    return track;
  }

  private buildTrackId(seed: string): string {
    if (!this.tracks.has(seed)) return seed;
    let idx = 1;
    while (this.tracks.has(`${seed}-${idx}`)) {
      idx += 1;
    }
    return `${seed}-${idx}`;
  }

  private applyMmsi(track: AisTrack, value: unknown): void {
    const next = this.toStringOrUndefined(value);
    if (!next) return;

    const conflicts = this.getTracksByMmsi(next).filter(existing => existing.id !== track.id);
    if (conflicts.length) {
      this.markConflict(next);
      if (AIS_DEBUG) {
        console.error('[AIS] MMSI conflict', {
          mmsi: next,
          contexts: [track.context, ...conflicts.map(item => item.context)]
        });
      }
    }

    if (track.mmsi && track.mmsi !== next) {
      this.removeMmsiIndex(track.mmsi, track.id);
    }

    track.mmsi = next;
    this.addMmsiIndex(next, track.id);
  }

  private removeTrack(track: AisTrack): void {
    this.tracks.delete(track.id);
    if (track.mmsi) this.removeMmsiIndex(track.mmsi, track.id);
    for (const [context, id] of this.contextIndex.entries()) {
      if (id === track.id) this.contextIndex.delete(context);
    }
    if (AIS_DEBUG) {
      console.debug('[AIS] removed', { id: track.id, mmsi: track.mmsi, status: track.ais.status });
    }
    this.updateTargetsSignal();
  }

  private updateTargetsSignal(): void {
    this.targetsDirty$.next();
  }

  private flushTargetsSignal(): void {
    const nextTargets = Array.from(this.tracks.values()).filter(track => Boolean(track.mmsi) || Boolean(track.position));
    const hasCollisionRiskData = nextTargets.some(track => {
      if (!this.isVesselLike(track)) return false;
      const closest = track.closestApproach ?? {};
      return Object.prototype.hasOwnProperty.call(closest, 'collisionRiskRating');
    });
    this._targets.set(nextTargets);
    this._hasCollisionRiskData.set(hasCollisionRiskData);
    if (AIS_DEBUG) {
      console.debug('[AIS] flush', { count: this.tracks.size });
    }
  }

  private getTracksByMmsi(mmsi: string): AisTrack[] {
    const ids = this.mmsiIndex.get(mmsi);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.tracks.get(id))
      .filter((track): track is AisTrack => Boolean(track));
  }

  private addMmsiIndex(mmsi: string, id: string): void {
    if (!this.mmsiIndex.has(mmsi)) {
      this.mmsiIndex.set(mmsi, new Set());
    }
    this.mmsiIndex.get(mmsi)!.add(id);
  }

  private removeMmsiIndex(mmsi: string, id: string): void {
    const set = this.mmsiIndex.get(mmsi);
    if (!set) return;
    set.delete(id);
    if (!set.size) this.mmsiIndex.delete(mmsi);
  }

  private markConflict(mmsi: string): void {
    const tracks = this.getTracksByMmsi(mmsi);
    for (const track of tracks) {
      track.conflicted = true;
    }
  }

  private normalizeAisClass(value: unknown): AisClass {
    const raw = typeof value === 'string' ? value.toUpperCase() : '';
    if (raw === 'A') return 'A';
    if (raw === 'B') return 'B';
    return undefined;
  }

  private normalizeAisStatus(value: unknown): AisStatus | undefined {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).toLowerCase();
    if (normalized === 'unconfirmed' || normalized === 'confirmed' || normalized === 'lost' || normalized === 'remove') {
      return normalized;
    }
    return undefined;
  }
  private toTimestampMs(value: Date | string | null | undefined): number {
    if (!value) return Date.now();
    const ts = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(ts) ? ts : Date.now();
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str.length ? str : undefined;
  }

  private wrapDegrees(angle: number): number {
    const normalized = angle % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  private buildBaseTarget(
    context: string,
    type: AisTargetType,
    timestampMs: number,
    mmsi: string | undefined,
    id: string
  ): AisTarget {
    return {
      id,
      context,
      type,
      ais: {
        class: undefined,
        status: 'unconfirmed'
      },
      conflicted: false,
      mmsi,
      position: undefined,
      lastUpdateAt: timestampMs,
      lastPositionAt: undefined
    };
  }

  private isVesselLike(track: AisTrack): track is AisVessel | AisSar {
    return track.type === 'vessel' || track.type === 'sar';
  }

  private isAton(track: AisTrack): track is AisAton {
    return track.type === 'aton';
  }

  private readPositionValue(value: unknown): Position | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const latitude = this.toNumberOrUndefined((value as { latitude?: unknown }).latitude);
    const longitude = this.toNumberOrUndefined((value as { longitude?: unknown }).longitude);
    if (latitude === undefined || longitude === undefined) return undefined;
    const altitude = this.toNumberOrUndefined((value as { altitude?: unknown }).altitude);
    return { latitude, longitude, altitude };
  }
}
