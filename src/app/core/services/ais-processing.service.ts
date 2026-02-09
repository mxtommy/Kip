import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject, interval, merge, throttleTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService, IPathUpdateWithPath } from './data.service';

const AIS_DEBUG = false;

// AIS processing defaults
const AIS_DEFAULTS = {
  classA: {
    confirmAfterMsgs: 2,
    confirmMaxAge: 30,      // s
    lostAfter: 60,          // s
    removeAfter: 180,       // s
    interpHz: 1
  },
  classB: {
    confirmAfterMsgs: 3,
    confirmMaxAge: 90,      // s
    lostAfter: 180,         // s
    removeAfter: 600,       // s
    interpHz: 0.5
  }
} as const;

type AisClass = 'A' | 'B' | undefined;
type AisTargetType = 'vessel' | 'aton' | 'basestation' | 'sar';
export type AisStatus = 'unconfirmed' | 'confirmed' | 'lost';

export interface AisTrackPosition {
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface AisTrack {
  id: string;
  context: string;
  type: AisTargetType;
  status: AisStatus;
  aisClass: AisClass;
  conflicted: boolean;
  msgCount: number;
  mmsi?: string;
  name?: string;
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
  position?: AisTrackPosition;
  positionAlt?: number;
  navState?: string;
  headingTrue?: number;
  courseOverGroundTrue?: number;
  speedOverGround?: number;
  rateOfTurn?: number;
  specialManeuver?: string;
  fromBow?: number;
  fromCenter?: number;
  aisType?: string;
  atonType?: { id?: number; name?: string };
  atonVirtual?: boolean;
  atonOffPosition?: boolean;
  lastUpdateAt?: number;
  lastPositionAt?: number; // timestamp of last position report
  // Collision avoidance fields from SignalK AIS Target Prioritizer plugin
  closestApproach?: {
    distance?: number; // NM
    timeTo?: number;   // s
    range?: number;    // NM
    bearing?: number;  // deg
    collisionRiskRating?: number; // lower is more risky
  };
}

export interface OwnShipState {
  position?: AisTrackPosition;
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
  private readonly lastPositionReportAt = new Map<string, number>();
  private readonly targetsDirty$ = new Subject<void>();

  private readonly _targets = signal<AisTrack[]>([]);
  private readonly _ownShip = signal<OwnShipState>({});

  public readonly targets = this._targets.asReadonly();
  public readonly ownShip = this._ownShip.asReadonly();

  public getBearingTrue(from: AisTrackPosition, to: AisTrackPosition): number | null {
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
      .pipe(throttleTime(250, undefined, { leading: true, trailing: true }), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.flushTargetsSignal());

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateTrackStatuses());
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
    if (update.path.startsWith('navigation.closestApproach.') && !track.closestApproach) {
      track.closestApproach = {};
    }

    switch (update.path) {
      case 'mmsi':
        this.applyMmsi(track, update.value);
        break;
      case 'name':
        track.name = this.toStringOrUndefined(update.value);
        break;
      case 'communication.callsignVhf':
        track.callsign = this.toStringOrUndefined(update.value);
        break;
      case 'navigation.destination':
        track.destination = this.toStringOrUndefined(update.value);
        break;
      case 'navigation.destination.commonName':
        track.destination = this.toStringOrUndefined(update.value);
        break;
      case 'navigation.destination.eta':
        track.eta = this.toStringOrUndefined(update.value);
        break;
      case 'design.beam':
        track.design = { ...(track.design ?? {}), beam: this.toNumberOrUndefined(update.value) };
        break;
      case 'design.length.overall':
        track.design = {
          ...(track.design ?? {}),
          length: { ...(track.design?.length ?? {}), overall: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.length.hull':
        track.design = {
          ...(track.design ?? {}),
          length: { ...(track.design?.length ?? {}), hull: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.length.waterline':
        track.design = {
          ...(track.design ?? {}),
          length: { ...(track.design?.length ?? {}), waterline: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.draft.maximum':
        track.design = {
          ...(track.design ?? {}),
          draft: { ...(track.design?.draft ?? {}), maximum: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.draft.minimum':
        track.design = {
          ...(track.design ?? {}),
          draft: { ...(track.design?.draft ?? {}), minimum: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.draft.current':
        track.design = {
          ...(track.design ?? {}),
          draft: { ...(track.design?.draft ?? {}), current: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.draft.canoe':
        track.design = {
          ...(track.design ?? {}),
          draft: { ...(track.design?.draft ?? {}), canoe: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'registrations.imo':
        track.imo = this.toStringOrUndefined(update.value);
        break;
      case 'navigation.courseOverGroundTrue':
        track.courseOverGroundTrue = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.headingTrue':
        track.headingTrue = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.rateOfTurn':
        track.rateOfTurn = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.specialManeuver':
        track.specialManeuver = this.toStringOrUndefined(update.value);
        break;
      case 'navigation.speedOverGround':
        track.speedOverGround = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.state':
        track.navState = this.toStringOrUndefined(update.value);
        break;
      case 'sensors.ais.class':
        track.aisClass = this.normalizeAisClass(update.value);
        break;
      case 'sensors.ais.fromBow':
        track.fromBow = this.toNumberOrUndefined(update.value);
        break;
      case 'sensors.ais.fromCenter':
        track.fromCenter = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.position.latitude':
        {
          const latitude = this.toNumberOrUndefined(update.value);
          if (latitude === undefined) break;
          track.position = { ...(track.position ?? {}), latitude };
          this.registerPositionReport(track, update.timestampMs);
        }
        break;
      case 'navigation.position.longitude':
        {
          const longitude = this.toNumberOrUndefined(update.value);
          if (longitude === undefined) break;
          track.position = { ...(track.position ?? {}), longitude };
          this.registerPositionReport(track, update.timestampMs);
        }
        break;
      case 'navigation.position.altitude':
        {
          const altitude = this.toNumberOrUndefined(update.value);
          track.positionAlt = altitude;
          if (track.position) {
            track.position = { ...track.position, altitude };
          }
        }
        break;
      case 'navigation.position': {
        const position = this.readPositionValue(update.value);
        if (position) {
          track.position = position;
          this.registerPositionReport(track, update.timestampMs);
        }
        break;
      }
      case 'atonType.id':
        track.atonType = { ...(track.atonType ?? {}), id: this.toNumberOrUndefined(update.value) };
        break;
      case 'atonType.name':
        track.atonType = { ...(track.atonType ?? {}), name: this.toStringOrUndefined(update.value) };
        break;
      case 'virtual':
        track.atonVirtual = Boolean(update.value);
        break;
      case 'offPosition':
        track.atonOffPosition = Boolean(update.value);
        break;
      case 'design.aisShipType.id':
        track.design = {
          ...(track.design ?? {}),
          aisShipType: { ...(track.design?.aisShipType ?? {}), id: this.toNumberOrUndefined(update.value) }
        };
        break;
      case 'design.aisShipType.name':
        track.design = {
          ...(track.design ?? {}),
          aisShipType: { ...(track.design?.aisShipType ?? {}), name: this.toStringOrUndefined(update.value) }
        };
        break;
      case 'navigation.closestApproach.distance':
        track.closestApproach!.distance = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.closestApproach.timeTo':
        track.closestApproach!.timeTo = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.closestApproach.range':
        track.closestApproach!.range = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.closestApproach.bearing':
        track.closestApproach!.bearing = this.toNumberOrUndefined(update.value);
        break;
      case 'navigation.closestApproach.collisionRiskRating':
        track.closestApproach!.collisionRiskRating = this.toNumberOrUndefined(update.value);
        break;
      default:
        //console.warn('[AIS] unhandled update path', { path: update.path, value: update.value });
        break;
    }

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
    const track: AisTrack = {
      id,
      context,
      type,
      status: 'unconfirmed',
      aisClass: undefined,
      conflicted: false,
      msgCount: 0,
      mmsi,
      position: undefined,
      closestApproach: {},
      lastUpdateAt: timestampMs,
      lastPositionAt: undefined
    };

    this.tracks.set(track.id, track);
    if (mmsi) this.addMmsiIndex(mmsi, track.id);
    this.lastPositionReportAt.set(track.id, 0);
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

  private registerPositionReport(track: AisTrack, timestampMs: number): void {
    if (
      !track.position
      || typeof track.position.latitude !== 'number'
      || typeof track.position.longitude !== 'number'
    ) return;

    if (track.type === 'aton') {
      track.lastPositionAt = timestampMs;
      this.tryConfirm(track, timestampMs);
      return;
    }

    const lastReport = this.lastPositionReportAt.get(track.id) ?? 0;
    if (Math.abs(timestampMs - lastReport) > 500) {
      track.msgCount += 1;
      this.lastPositionReportAt.set(track.id, timestampMs);
    }

    track.lastPositionAt = timestampMs;

    this.tryConfirm(track, timestampMs);
  }

  private tryConfirm(track: AisTrack, nowMs: number): void {
    if (track.conflicted) return;
    const defaults = this.getDefaults(track.aisClass);
    const ageSec = track.lastPositionAt ? (nowMs - track.lastPositionAt) / 1000 : Number.POSITIVE_INFINITY;

    if (track.msgCount >= defaults.confirmAfterMsgs && ageSec <= defaults.confirmMaxAge) {
      track.status = 'confirmed';
    } else if (ageSec <= defaults.lostAfter) {
      track.status = 'unconfirmed';
    }
  }

  private updateTrackStatuses(): void {
    const nowMs = Date.now();
    let changed = false;

    for (const track of this.tracks.values()) {
      const defaults = this.getDefaults(track.aisClass);
      const ageSec = track.lastPositionAt ? (nowMs - track.lastPositionAt) / 1000 : Number.POSITIVE_INFINITY;

      if (ageSec > defaults.removeAfter) {
        this.tracks.delete(track.id);
        if (track.mmsi) this.removeMmsiIndex(track.mmsi, track.id);
        for (const [context, id] of this.contextIndex.entries()) {
          if (id === track.id) this.contextIndex.delete(context);
        }
        this.lastPositionReportAt.delete(track.id);
        if (AIS_DEBUG) {
          console.debug('[AIS] removed', { id: track.id, mmsi: track.mmsi, ageSec });
        }
        changed = true;
        continue;
      }

      if (ageSec > defaults.lostAfter) {
        if (track.status !== 'lost') {
          track.status = 'lost';
          if (AIS_DEBUG) {
            console.debug('[AIS] lost', { id: track.id, mmsi: track.mmsi, ageSec });
          }
          changed = true;
        }
        continue;
      }

      if (track.msgCount >= defaults.confirmAfterMsgs && ageSec <= defaults.confirmMaxAge) {
        if (track.status !== 'confirmed') {
          if (!track.conflicted) {
            track.status = 'confirmed';
            if (AIS_DEBUG) {
              console.debug('[AIS] confirmed', { id: track.id, mmsi: track.mmsi, ageSec });
            }
          } else if (track.status !== 'unconfirmed') {
            track.status = 'unconfirmed';
          }
          changed = true;
        }
      } else if (track.status !== 'unconfirmed') {
        track.status = 'unconfirmed';
        if (AIS_DEBUG) {
          console.debug('[AIS] unconfirmed', { id: track.id, mmsi: track.mmsi, ageSec });
        }
        changed = true;
      }
    }

    if (changed) this.updateTargetsSignal();
  }

  private updateTargetsSignal(): void {
    this.targetsDirty$.next();
  }

  private flushTargetsSignal(): void {
    this._targets.set(Array.from(this.tracks.values()).filter(track => Boolean(track.mmsi) || Boolean(track.position)));
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

  private getDefaults(aisClass: AisClass) {
    return aisClass === 'A' ? AIS_DEFAULTS.classA : AIS_DEFAULTS.classB;
  }

  private markConflict(mmsi: string): void {
    const tracks = this.getTracksByMmsi(mmsi);
    for (const track of tracks) {
      track.conflicted = true;
      if (track.status !== 'unconfirmed') {
        track.status = 'unconfirmed';
      }
    }
  }

  private normalizeAisClass(value: unknown): AisClass {
    const raw = typeof value === 'string' ? value.toUpperCase() : '';
    if (raw === 'A') return 'A';
    if (raw === 'B') return 'B';
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

  private distanceNm(a: AisTrackPosition, b: AisTrackPosition): number {
    if (
      typeof a.latitude !== 'number'
      || typeof a.longitude !== 'number'
      || typeof b.latitude !== 'number'
      || typeof b.longitude !== 'number'
    ) return 0;
    const R = 6371e3; // meters
    const phi1 = a.latitude * Math.PI / 180;
    const phi2 = b.latitude * Math.PI / 180;
    const dPhi = (b.latitude - a.latitude) * Math.PI / 180;
    const dLambda = (b.longitude - a.longitude) * Math.PI / 180;

    const sinDP = Math.sin(dPhi / 2);
    const sinDL = Math.sin(dLambda / 2);
    const h = sinDP * sinDP + Math.cos(phi1) * Math.cos(phi2) * sinDL * sinDL;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    const meters = R * c;
    return meters / 1852;
  }

  private wrapDegrees(angle: number): number {
    const normalized = angle % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  private readPositionValue(value: unknown): AisTrackPosition | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const latitude = this.toNumberOrUndefined((value as { latitude?: unknown }).latitude);
    const longitude = this.toNumberOrUndefined((value as { longitude?: unknown }).longitude);
    if (latitude === undefined || longitude === undefined) return undefined;
    const altitude = this.toNumberOrUndefined((value as { altitude?: unknown }).altitude);
    return { latitude, longitude, altitude };
  }
}
