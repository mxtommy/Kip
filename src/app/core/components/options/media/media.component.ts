import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';

import { ToastService } from '../../../services/toast.service';
import { ImageAssetService, IImageCacheStats } from '../../../services/image-asset.service';
import { DialogService } from '../../../services/dialog.service';

/**
 * Media settings tab. Hosts the image-cache card (on-disk size + purge of generated variants).
 * Kept separate from the Configurations tab, which is for KIP config management (backup/restore).
 */
@Component({
    selector: 'settings-media',
    templateUrl: './media.component.html',
    styleUrls: ['./media.component.scss'],
    imports: [MatButton, MatDivider]
})
export class SettingsMediaComponent {
  private toast = inject(ToastService);
  private images = inject(ImageAssetService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);

  protected readonly imageCacheStats = signal<IImageCacheStats | null>(null);
  protected readonly imageCachePurging = signal(false);
  protected readonly imageCacheDisplay = computed(() => {
    const stats = this.imageCacheStats();
    if (!stats) {
      return 'Unavailable';
    }
    return `${this.formatBytes(stats.bytes)} · ${stats.files} file${stats.files === 1 ? '' : 's'}`;
  });

  constructor() {
    this.refreshImageCache();
  }

  /** Refresh the on-disk image-cache size shown in the settings card. */
  public refreshImageCache(): void {
    if (!this.images.ready) {
      this.imageCacheStats.set(null);
      return;
    }
    this.images.cacheStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (stats) => this.imageCacheStats.set(stats),
      error: () => this.imageCacheStats.set(null)
    });
  }

  /** Clear the resized image copies (originals are kept and recreated on demand). */
  public purgeImageCache(): void {
    this.dialog.openConfirmationDialog({
      title: 'Clear image cache?',
      message: 'Clear the resized copies of all images? Your originals are kept and recreated when needed.',
      confirmBtnText: 'Clear',
      cancelBtnText: 'Cancel'
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.imageCachePurging.set(true);
      this.images.purgeCache().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.imageCachePurging.set(false);
          this.toast.show('Cache cleared', 1000, true, 'success');
          this.refreshImageCache();
        },
        error: (error: HttpErrorResponse) => {
          this.imageCachePurging.set(false);
          this.toast.show("Couldn't clear the image cache: " + (error?.statusText ?? error), 0, false, 'error');
        }
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }
}
