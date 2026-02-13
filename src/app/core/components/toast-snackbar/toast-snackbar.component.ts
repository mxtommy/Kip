import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type ToastSeverity = 'message' | 'info' | 'warn' | 'error' | 'success';

export interface ToastSnackbarData {
  message: string;
  action?: string;
  severity?: ToastSeverity;
  title?: string;
}

@Component({
  selector: 'toast-snackbar',
  templateUrl: './toast-snackbar.component.html',
  styleUrl: './toast-snackbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  host: {
    '[class]': 'hostClass()'
  }
})
export class ToastSnackbarComponent {
  private readonly ref = inject(MatSnackBarRef<ToastSnackbarComponent>);
  protected readonly data = inject<ToastSnackbarData>(MAT_SNACK_BAR_DATA);

  protected readonly severity = computed<ToastSeverity>(() => this.data.severity ?? 'message');
  protected readonly hasAction = computed(() => !!this.data.action);
  protected readonly title = computed(() => this.data.title ?? this.titleForSeverity(this.severity()));
  protected readonly icon = computed(() => this.iconForSeverity(this.severity()));
  protected readonly hostClass = computed(() => `toast-${this.severity()}`);

  protected onActionClick(): void {
    this.ref.dismissWithAction();
  }

  protected dismiss(): void {
    this.ref.dismiss();
  }

  private titleForSeverity(severity: ToastSeverity): string {
    switch (severity) {
      case 'success':
        return 'Success';
      case 'warn':
        return 'Warning';
      case 'error':
        return 'Error';
      case 'info':
        return 'Info';
      default:
        return 'Message';
    }
  }

  private iconForSeverity(severity: ToastSeverity): string {
    switch (severity) {
      case 'success':
        return 'check';
      case 'warn':
        return 'warning';
      case 'error':
        return 'error';
      case 'info':
        return 'info';
      default:
        return 'message';
    }
  }
}
