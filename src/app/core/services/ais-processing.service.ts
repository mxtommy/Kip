import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IPathValueData } from '../interfaces/app-interfaces';
import { SignalKDeltaService } from './signalk-delta.service';

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

type AisClass = 'A' | 'B' | null;
type AisTargetType = 'vessel' | 'aton';
export type AisStatus = 'unconfirmed' | 'confirmed' | 'lost';

export interface AisTrackPosition {
  lat: number;
  lon: number;
}

export interface AisTrack {
  id: string;
  context: string;
  type: AisTargetType;
  status: AisStatus;
  aisClass: AisClass;
  msgCount: number;
  mmsi: string | null;
  name?: string | null;
  callsign?: string | null;
  destination?: string | null;
  beam?: number | null;
  length?: number | null;
  draft?: number | null;
  imo?: string | null;
  position?: AisTrackPosition | null;
  navState?: string | null;
  headingTrue?: number | null;
  courseOverGroundTrue?: number | null;
  speedOverGround?: number | null;
  rateOfTurn?: number | null;
  specialManeuver?: string | null;
  fromBow?: number | null;
  fromCenter?: number | null;
  aisShipType?: string | number | null;
  atonType?: { id?: number | null; name?: string | null } | null;
  atonVirtual?: boolean | null;
  atonOffPosition?: boolean | null;
  lastUpdateAt?: number | null;
  lastPositionAt?: number | null;
  lastPositionReportAt?: number | null;
  trail: { lat: number; lon: number; ts: number }[];
}

export interface OwnShipState {
  position?: AisTrackPosition | null;
  headingTrue?: number | null;
  courseOverGroundTrue?: number | null;
  speedOverGround?: number | null;
}

interface AisUpdate {
  context: string;
  type: AisTargetType;
  path: string;
  value: unknown;
  timestampMs: number;
}

const VESSEL_CONTEXT_PREFIX = 'vessels.';
const ATON_CONTEXT_PREFIX = 'atons.';

@Injectable({
  providedIn: 'root'
})
export class AisProcessingService {
  private readonly delta = inject(SignalKDeltaService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tracks = new Map<string, AisTrack>();
  private readonly contextIndex = new Map<string, string>();
  private readonly mmsiIndex = new Map<string, Set<string>>();

  private readonly _targets = signal<AisTrack[]>([]);
  private readonly _ownShip = signal<OwnShipState>({});

  public readonly targets = this._targets.asReadonly();
  public readonly ownShip = this._ownShip.asReadonly();

  constructor() {
    this.delta.subscribeDataPathsUpdates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => this.handleDelta(update));

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateTrackStatuses());
  }

  private handleDelta(update: IPathValueData): void {
    if (!update?.context || !update?.path) return;

    if (update.context === 'self') {
      this.applyOwnShipUpdate(update);
      return;
    }

    if (update.context.startsWith(VESSEL_CONTEXT_PREFIX)) {
      this.applyAisUpdate(this.buildUpdate(update, 'vessel'));
      return;
    }

    if (update.context.startsWith(ATON_CONTEXT_PREFIX)) {
      this.applyAisUpdate(this.buildUpdate(update, 'aton'));
    }
  }

  private buildUpdate(update: IPathValueData, type: AisTargetType): AisUpdate {
    return {
      context: update.context,
      type,
      path: update.path,
      value: update.value,
      timestampMs: this.toTimestampMs(update.timestamp)
    };
  }

  private applyOwnShipUpdate(update: IPathValueData): void {
    const path = update.path;
    const value = update.value;
    const next = { ...this._ownShip() } as OwnShipState;

    switch (path) {
      case 'navigation.position.latitude':
        next.position = { ...(next.position ?? { lat: 0, lon: 0 }), lat: this.toNumber(value) };
        break;
      case 'navigation.position.longitude':
        next.position = { ...(next.position ?? { lat: 0, lon: 0 }), lon: this.toNumber(value) };
        break;
      case 'navigation.headingTrue':
        next.headingTrue = this.toNumberOrNull(value);
        break;
      case 'navigation.courseOverGroundTrue':
        next.courseOverGroundTrue = this.toNumberOrNull(value);
        break;
      case 'navigation.speedOverGround':
        next.speedOverGround = this.toNumberOrNull(value);
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

    switch (update.path) {
      case 'mmsi':
        this.applyMmsi(track, update.value);
        break;
      case 'name':
        track.name = this.toStringOrNull(update.value);
        break;
      case 'communication.callsignVhf':
        track.callsign = this.toStringOrNull(update.value);
        break;
      case 'navigation.destination.commonName':
        track.destination = this.toStringOrNull(update.value);
        break;
      case 'design.beam':
        track.beam = this.toNumberOrNull(update.value);
        break;
      case 'design.length.overall':
        track.length = this.toNumberOrNull(update.value);
        break;
      case 'design.draft.maximum':
        track.draft = this.toNumberOrNull(update.value);
        break;
      case 'registrations.imo':
        track.imo = this.toStringOrNull(update.value);
        break;
      case 'navigation.courseOverGroundTrue':
        track.courseOverGroundTrue = this.toNumberOrNull(update.value);
        break;
      case 'navigation.headingTrue':
        track.headingTrue = this.toNumberOrNull(update.value);
        break;
      case 'navigation.rateOfTurn':
        track.rateOfTurn = this.toNumberOrNull(update.value);
        break;
      case 'navigation.specialManeuver':
        track.specialManeuver = this.toStringOrNull(update.value);
        break;
      case 'navigation.speedOverGround':
        track.speedOverGround = this.toNumberOrNull(update.value);
        break;
      case 'navigation.state':
        track.navState = this.toStringOrNull(update.value);
        break;
      case 'sensors.ais.class':
        track.aisClass = this.normalizeAisClass(update.value);
        break;
      case 'sensors.ais.fromBow':
        track.fromBow = this.toNumberOrNull(update.value);
        break;
      case 'sensors.ais.fromCenter':
        track.fromCenter = this.toNumberOrNull(update.value);
        break;
      case 'navigation.position.latitude':
        track.position = { ...(track.position ?? { lat: 0, lon: 0 }), lat: this.toNumber(update.value) };
        this.registerPositionReport(track, update.timestampMs);
        break;
      case 'navigation.position.longitude':
        track.position = { ...(track.position ?? { lat: 0, lon: 0 }), lon: this.toNumber(update.value) };
        this.registerPositionReport(track, update.timestampMs);
        break;
      case 'atonType.id':
        track.atonType = { ...(track.atonType ?? {}), id: this.toNumberOrNull(update.value) };
        break;
      case 'atonType.name':
        track.atonType = { ...(track.atonType ?? {}), name: this.toStringOrNull(update.value) };
        break;
      case 'virtual':
        track.atonVirtual = Boolean(update.value);
        break;
      case 'offPosition':
        track.atonOffPosition = Boolean(update.value);
        break;
      case 'design.aisShipType':
      case 'design.type':
        track.aisShipType = update.value as string | number;
        break;
      default:
        break;
    }

    this.updateTargetsSignal();
  }

  private resolveTrack(update: AisUpdate): AisTrack | null {
    const existingId = this.contextIndex.get(update.context);
    const timestampMs = update.timestampMs;

    if (existingId) {
      const existing = this.tracks.get(existingId);
      if (!existing) return null;

      if (this.isPositionUpdate(update) && !this.isPlausibleUpdate(existing, update, timestampMs)) {
        const forked = this.forkTrack(existing, update.context, update.type, timestampMs);
        this.contextIndex.set(update.context, forked.id);
        return forked;
      }

      return existing;
    }

    const mmsi = this.isMmsiUpdate(update) ? this.toStringOrNull(update.value) : null;
    if (!mmsi) {
      const created = this.createTrack(update.context, update.type, timestampMs, null);
      this.contextIndex.set(update.context, created.id);
      return created;
    }

    const candidates = this.getTracksByMmsi(mmsi);
    const matched = candidates.find(track => this.isPlausibleUpdate(track, update, timestampMs));

    if (matched) {
      matched.context = update.context;
      this.contextIndex.set(update.context, matched.id);
      return matched;
    }

    const forked = this.createTrack(update.context, update.type, timestampMs, mmsi);
    this.contextIndex.set(update.context, forked.id);
    return forked;
  }

  private forkTrack(base: AisTrack, context: string, type: AisTargetType, timestampMs: number): AisTrack {
    const mmsi = base.mmsi;
    const forked = this.createTrack(context, type, timestampMs, mmsi);
    return forked;
  }

  private createTrack(context: string, type: AisTargetType, timestampMs: number, mmsi: string | null): AisTrack {
    const id = this.buildTrackId(mmsi ?? context);
    const track: AisTrack = {
      id,
      context,
      type,
      status: 'unconfirmed',
      aisClass: null,
      msgCount: 0,
      mmsi,
      position: null,
      trail: [],
      lastUpdateAt: timestampMs,
      lastPositionAt: null,
      lastPositionReportAt: null
    };

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
    const next = this.toStringOrNull(value);
    if (!next) return;

    if (track.mmsi && track.mmsi !== next) {
      this.removeMmsiIndex(track.mmsi, track.id);
    }

    track.mmsi = next;
    this.addMmsiIndex(next, track.id);
  }

  private registerPositionReport(track: AisTrack, timestampMs: number): void {
    if (!track.position) return;

    const lastReport = track.lastPositionReportAt ?? 0;
    if (Math.abs(timestampMs - lastReport) > 500) {
      track.msgCount += 1;
      track.lastPositionReportAt = timestampMs;
    }

    track.lastPositionAt = timestampMs;
    track.trail.push({
      lat: track.position.lat,
      lon: track.position.lon,
      ts: timestampMs
    });

    if (track.trail.length > 120) {
      track.trail.splice(0, track.trail.length - 120);
    }

    this.tryConfirm(track, timestampMs);
  }

  private tryConfirm(track: AisTrack, nowMs: number): void {
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
        changed = true;
        continue;
      }

      if (ageSec > defaults.lostAfter) {
        if (track.status !== 'lost') {
          track.status = 'lost';
          changed = true;
        }
        continue;
      }

      if (track.msgCount >= defaults.confirmAfterMsgs && ageSec <= defaults.confirmMaxAge) {
        if (track.status !== 'confirmed') {
          track.status = 'confirmed';
          changed = true;
        }
      } else if (track.status !== 'unconfirmed') {
        track.status = 'unconfirmed';
        changed = true;
      }
    }

    if (changed) this.updateTargetsSignal();
  }

  private updateTargetsSignal(): void {
    this._targets.set(Array.from(this.tracks.values()));
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

  private isMmsiUpdate(update: AisUpdate): boolean {
    return update.path === 'mmsi';
  }

  private isPositionUpdate(update: AisUpdate): boolean {
    return update.path === 'navigation.position.latitude' || update.path === 'navigation.position.longitude';
  }

  private isPlausibleUpdate(track: AisTrack, update: AisUpdate, timestampMs: number): boolean {
    if (!this.isPositionUpdate(update)) return true;
    if (!track.position || !track.lastPositionAt) return true;

    const nextPosition = this.extractPosition(track.position, update);
    if (!nextPosition) return true;

    const dtHours = Math.max((timestampMs - track.lastPositionAt) / 3600000, 0.0001);
    const distanceNm = this.distanceNm(track.position, nextPosition);
    const impliedSpeed = distanceNm / dtHours;
    const maxSpeed = track.aisClass === 'A' ? 70 : 50;

    return impliedSpeed <= maxSpeed * 2;
  }

  private extractPosition(current: AisTrackPosition, update: AisUpdate): AisTrackPosition | null {
    if (!this.isPositionUpdate(update)) return null;

    if (update.path === 'navigation.position.latitude') {
      return { lat: this.toNumber(update.value), lon: current.lon };
    }

    return { lat: current.lat, lon: this.toNumber(update.value) };
  }

  private normalizeAisClass(value: unknown): AisClass {
    const raw = typeof value === 'string' ? value.toUpperCase() : '';
    if (raw === 'A') return 'A';
    if (raw === 'B') return 'B';
    return null;
  }

  private toTimestampMs(value: string | null | undefined): number {
    if (!value) return Date.now();
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : Date.now();
  }

  private toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private toNumberOrNull(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toStringOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str.length ? str : null;
  }

  private distanceNm(a: AisTrackPosition, b: AisTrackPosition): number {
    const R = 6371e3; // meters
    const phi1 = a.lat * Math.PI / 180;
    const phi2 = b.lat * Math.PI / 180;
    const dPhi = (b.lat - a.lat) * Math.PI / 180;
    const dLambda = (b.lon - a.lon) * Math.PI / 180;

    const sinDP = Math.sin(dPhi / 2);
    const sinDL = Math.sin(dLambda / 2);
    const h = sinDP * sinDP + Math.cos(phi1) * Math.cos(phi2) * sinDL * sinDL;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    const meters = R * c;
    return meters / 1852;
  }
}
