import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import type { DialogComponentData } from '../../interfaces/dialog-data';
import type { AisTrack } from '../../services/ais-processing.service';
import { UnitsService } from '../../services/units.service';

interface AisDialogPayload {
  target: AisTrack;
}

@Component({
  selector: 'dialog-ais-target',
  imports: [CommonModule, MatDialogModule],
  templateUrl: './dialog-ais-target.component.html'
})
export class DialogAisTargetComponent {
  private readonly data = inject<DialogComponentData>(MAT_DIALOG_DATA);
  private readonly units = inject(UnitsService);

  protected get payload(): AisDialogPayload | null {
    return (this.data?.payload as AisDialogPayload) ?? null;
  }

  protected get target(): AisTrack | null {
    return this.payload?.target ?? null;
  }

  protected formatAngle(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return this.units.convertToUnit('deg', value).toString();
  }

  protected formatLatLon(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return value.toFixed(5);
  }

  protected formatText(value: string | null | undefined): string {
    return value && value.length ? value : '--';
  }

  protected formatStatus(value: string | null | undefined): string {
    return value ? value.toUpperCase() : '--';
  }
}
