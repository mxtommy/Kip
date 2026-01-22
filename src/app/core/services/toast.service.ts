import { Injectable, signal, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppSettingsService } from './app-settings.service';

export interface SnackItem {
  message: string;
  duration?: number;
  silent?: boolean;
  action?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly appSettingsService = inject(AppSettingsService);
  private toastAudio: HTMLAudioElement | null = null;

  // last snack for diagnostics/other UI (not a queue)
  readonly lastSnack = signal<SnackItem | null>(null);

  /**
   * Display a Material snackbar (fire-and-forget).
   *
   * @param message Text to be displayed.
   * @param duration Display duration in milliseconds before automatic dismissal.
   * Duration value of 0 is indefinite or until user clicks the action button.
   * Defaults to 10000 if no value is provided.
   * @param silent A boolean that defines if the notification should make no sound.
   * Defaults false.
   * @param action Label for the snackbar action button.
   */
  public show(message: string, duration = 10000, silent = false, action = 'Dismiss'): void {
    const snack: SnackItem = { message, duration, silent, action };
    this.lastSnack.set(snack);
    this.snackBar.open(message, action, {
      duration,
      verticalPosition: 'top'
    });

    if (silent || this.appSettingsService.getNotificationConfig().sound.disableSound) return;
    if (!this.toastAudio) {
      this.toastAudio = new Audio('assets/notification.mp3');
      this.toastAudio.preload = 'auto';
      this.toastAudio.volume = 0.3;
    }
    // restart sound for rapid successive notifications
    this.toastAudio.currentTime = 0;
    void this.toastAudio.play();
  }
}

