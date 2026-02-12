import { ChangeDetectionStrategy, Component, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import type { DialogComponentData } from '../../interfaces/dialog-data';
import type { AisAton, AisBasestation, AisSar, AisTrack, AisVessel } from '../../services/ais-processing.service';
import { UnitsService } from '../../services/units.service';

interface AisDialogPayload {
  target: AisTrack;
}

@Component({
  selector: 'dialog-ais-target',
  imports: [MatDialogModule, MatDividerModule, TitleCasePipe, DecimalPipe],
  templateUrl: './dialog-ais-target.component.html',
  styleUrls: ['./dialog-ais-target.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogAisTargetComponent implements OnDestroy {
  private static readonly CLOCK_INTERVAL_MS = 1000;
  private readonly data = inject<DialogComponentData>(MAT_DIALOG_DATA);
  private readonly units = inject(UnitsService);
  private readonly ngZone = inject(NgZone);
  private readonly now = signal(Date.now());
  private nowTimer: number | null = null;

  constructor() {
    this.startClock();
  }

  protected get payload(): AisDialogPayload | null {
    return (this.data?.payload as AisDialogPayload) ?? null;
  }

  protected get target(): AisTrack | null {
    return this.payload?.target ?? null;
  }

  protected formatDirection(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return this.units.convertToUnit('deg', value).toFixed(0);
  }

  protected formatNauticalMilesWithUnit(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return `${this.units.convertToUnit('nm', value).toFixed(1)} nm`;
  }

  protected formatAngleWithUnit(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return `${value.toFixed(0)}°`;
  }

  protected formatRemainingTime(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    const total = Math.max(0, Math.round(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  protected formatSinceTimestamp(timestampMs: number | null | undefined): string {
    if (timestampMs === null || timestampMs === undefined || !Number.isFinite(timestampMs)) return '--';
    const deltaSec = Math.max(0, Math.floor((this.now() - timestampMs) / 1000));
    const hours = Math.floor(deltaSec / 3600);
    const minutes = Math.floor((deltaSec % 3600) / 60);
    const seconds = deltaSec % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  protected formatRateOfTurn(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    const direction = value >= 0 ? 'Stb' : 'Port';
    const degreesPerMinute = Math.abs(value) * (180 / Math.PI) * 60;
    return `${direction} ${degreesPerMinute.toFixed(0)}°/min`;
  }

  protected formatLatLon(value: number | null | undefined, d : "latitudeMin" | "longitudeMin"): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return this.units.convertToUnit(d, value).toString();
  }

  protected formatText(value: string | null | undefined): string {
    return value && value.length ? value : '--';
  }

  protected hasClosestApproach(value: AisVessel['closestApproach'] | null | undefined): boolean {
    if (!value) return false;
    return typeof value.bearing === 'number'
      || typeof value.range === 'number'
      || typeof value.distance === 'number'
      || typeof value.timeTo === 'number';
  }

  protected isVesselLike(target: AisTrack): target is AisVessel | AisSar {
    return target.type === 'vessel' || target.type === 'sar';
  }

  protected isAton(target: AisTrack): target is AisAton {
    return target.type === 'aton';
  }

  protected isBasestation(target: AisTrack): target is AisBasestation {
    return target.type === 'basestation';
  }

  private startClock(): void {
    this.ngZone.runOutsideAngular(() => {
      this.nowTimer = window.setInterval(() => {
        this.ngZone.run(() => {
          this.now.set(Date.now());
        });
      }, DialogAisTargetComponent.CLOCK_INTERVAL_MS);
    });
  }

  ngOnDestroy(): void {
    if (this.nowTimer !== null) {
      clearInterval(this.nowTimer);
      this.nowTimer = null;
    }
  }
}
