import { ChangeDetectionStrategy, Component, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule, TitleCasePipe } from '@angular/common';
import type { DialogComponentData } from '../../interfaces/dialog-data';
import type { AisTrack } from '../../services/ais-processing.service';
import { UnitsService } from '../../services/units.service';

interface AisDialogPayload {
  target: AisTrack;
}

@Component({
  selector: 'dialog-ais-target',
  imports: [CommonModule, MatDialogModule, MatDividerModule, TitleCasePipe],
  templateUrl: './dialog-ais-target.component.html',
  styleUrls: ['./dialog-ais-target.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogAisTargetComponent implements OnDestroy {
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

  protected formatNauticalMiles(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return this.units.convertToUnit('nm', value).toString();
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

  protected formatStatus(value: string | null | undefined): string {
    return value ? value.toUpperCase() : '--';
  }

  protected hasClosestApproach(value: AisTrack['closestApproach'] | null | undefined): boolean {
    if (!value) return false;
    return value.bearing !== null && value.bearing !== undefined
      || value.range !== null && value.range !== undefined
      || value.distance !== null && value.distance !== undefined
      || value.timeTo !== null && value.timeTo !== undefined;
  }

  private startClock(): void {
    this.ngZone.runOutsideAngular(() => {
      this.nowTimer = window.setInterval(() => {
        this.ngZone.run(() => {
          this.now.set(Date.now());
        });
      }, 1000);
    });
  }

  ngOnDestroy(): void {
    if (this.nowTimer !== null) {
      clearInterval(this.nowTimer);
      this.nowTimer = null;
    }
  }
}
