import { Injectable, signal, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { AppSettingsService } from './app-settings.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ToastSnackbarComponent, type ToastSeverity, type ToastSnackbarData } from '../components/toast-snackbar/toast-snackbar.component';

export interface SnackItem {
  message: string;
  duration?: number;
  silent?: boolean;
  action?: string;
  severity?: ToastSeverity;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly app = inject(AppSettingsService);
  private readonly soundDisabled = toSignal(
    this.app.getNotificationServiceConfigAsO().pipe(
      map(config => config.sound.disableSound)
    ),
    { initialValue: this.app.getNotificationConfig().sound.disableSound }
  );
  private toastAudio: HTMLAudioElement | null = null;

  // last snack for diagnostics/other UI (not a queue)
  public readonly lastSnack = signal<SnackItem | null>(null);

  /**
   * Display a Material snackbar (fire-and-forget) and return its reference.
   *
   * @param message Text to be displayed.
   * @param duration Display duration in milliseconds before automatic dismissal.
   * Duration value of 0 is indefinite or until user clicks the action button.
   * Defaults to 10000 if no value is provided.
   * @param silent A boolean that defines if the notification should make no sound.
   * Defaults false.
   * @param severity Severity styling for the snackbar. Defaults to 'message'
   * - 'message': no icon or title
   * - 'info': blue info icon and Info title
   * - 'warn': yellow warning icon and Warning title
   * - 'error': red error icon and Error title
   * - 'success': green check icon and Completed title
   * @param action Optional label for the snackbar action button. When omitted, no action button is displayed.
   * @returns MatSnackBarRef you can use to dismiss, subscribe to `onAction()` and handle lifecycle events.
   *
   * @example
   * this.toastService.show('Configuration saved', 1000, true, 'success');
   *
   * @example
   * this.toastService.show('Plugin disabled', 0, true, 'warn', 'Enable Plugin');
   */
  public show(message: string, duration = 1500, silent = true, severity: ToastSeverity = 'message', action?: string): MatSnackBarRef<ToastSnackbarComponent> {
    const snack: SnackItem = { message, duration, silent, action, severity };
    const data: ToastSnackbarData = { message, action, severity };
    const ref = this.snackBar.openFromComponent(ToastSnackbarComponent, {
      duration,
      verticalPosition: 'top',
      data
    });

    this.lastSnack.set(snack);
    if (silent || this.soundDisabled()) return ref;
    if (!this.toastAudio) {
      this.toastAudio = new Audio('assets/notification.mp3');
      this.toastAudio.preload = 'auto';
      this.toastAudio.volume = 0.3;
    }
    // restart sound for rapid successive notifications
    this.toastAudio.currentTime = 0;
    void this.toastAudio.play();
    return ref;
  }
}

